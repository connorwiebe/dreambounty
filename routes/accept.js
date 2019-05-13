const accept = require('express-promise-router')()
const knex = require('knex')(require('../helpers/database')())
const err = require('../helpers/err')
const to = require('../helpers/to')
const oauth = require('../helpers/oauth')
const bouncer = require('../helpers/bouncer')
const ratelimit = require('../helpers/ratelimit')
const generateId = require('crypto-alphanumeric-id')
const mailer = require('../helpers/mailer')
const payout = require('../helpers/payout')
const old = require('../helpers/old')
const url = process.env.NODE_ENV === 'development' ? process.env.DEV_URL : process.env.URL

// get accept
accept.get('/:id', bouncer.recipientOnly, async (req, res, next) => {
  const id = req.params.id
  const username = req.session.username

  // get request
  let request = await knex.select('title','backers','raised','current_step').from('requests').where({id}).first()
  const { current_step } = request

  // validation
  const { stripe_account } = await knex.select('stripe_account').from('users').where({username}).first()
  if (!stripe_account) {
    req.session.flash = 'You have to add a Stripe account to accept requests.'
    req.session.pin = 'true'
    return req.session.save(() => res.redirect(`/${id}`))
  }
  if (!request.backers > 0) {
    req.session.flash = `You can't accept a request until it's raised some money.`
    req.session.pin = 'true'
    return req.session.save(() => res.redirect(`/${id}`))
  }

  // step subtitles
  const subtitles = {
    reauth: 'Step 1: Reauthentication',
    verified: 'Step 2: Email Verification',
    authorized: 'Step 3: Await Approval',
    accepted: 'Step 4: Accept the Request'
  }

  // user just reauthorized, go to next step
  if (current_step === 'reauth' && req.session.reauth === true) {
    await knex('requests').update({reauth:'now()',current_step:'verified'}).where({id})
    delete req.session.reauth
    return res.redirect(`/accept/${id}`)
  }

  // send verification email if it hasn't been sent yet
  if (current_step === 'verified') {
    let { token, email } = await knex.select(
      'requests.token',
      'users.email')
    .from('requests')
    .innerJoin('users', 'users.username', knex.raw('?',[username]))
    .where({id})
    .first()
    if (!token) {
      token = await generateId(36)
      await knex('requests').update({token,token_created:'now()'}).where({id})
      await mailer({
        to: email,
        subject: 'Please Verify Your Email',
        message: [ 'Click the link below to verify your email:',`${url}/accept/${token}/${id}` ]
      })
    }
  }

  // render
  res.render('accept', {
    request,
    subtitles,
    id
  })
})

// reauth
accept.post('/:id/reauth', bouncer.recipientOnly, async (req, res, next) => {
  const id = req.params.id

  // validation
  let { current_step } = await knex.select('current_step').from('requests').where({id}).first()
  if (current_step !== 'reauth') return next(err(403,`User tried to access a step that isn't the current step.`))

  req.session.redirect = `/accept/${id}`
  req.session.reauth = Date.now()
  await oauth.twitterRedirect(req, res, true)
})

// verify email
accept.get('/:paramsToken/:id', bouncer.recipientOnly, async (req, res, next) => {
  const username = req.session.username
  const { paramsToken, id } = req.params
  const { title, token, token_created, recipient } = await knex('requests').select('title','token','token_created','recipient').where({id}).andWhere({token:paramsToken}).first() || {}

  if (!token) return next()

  const { email } = await knex('users').select('email').where({username:recipient}).first()

  if (old(token_created, '>', '10m')) {
    const token = await generateId(36)
    await knex('requests').update({token,token_created:'now()'}).where({id})
    await mailer({
      to: email,
      subject: 'Please Verify Your Email',
      message: [ 'Click the link below to verify your email:',`${url}/accept/${token}/${id}` ]
    })
    return res.render('msg', {
      title: 'Verify Email | Dreambounty',
      msg: 'Token Expired',
      submsg: 'Another token has just been sent to your email.'
    })
  }

  // successfully verified email
  await knex('requests').update({verified:'now()',token:null,token_created:null,current_step:'authorized'}).where({id})

  // send email to platform informing it of the application
  await mailer({
    subject: `Application to accept request by ${recipient}`,
    message: [
      `Email of recipient: ${email}`,
      `Request: ${title}`,
      `Authorize the application: ${url}/admin/authorize/${id}/true`,
      `Reject the application: ${url}/admin/authorize/${id}/false`
    ]
  })

  res.render('msg', {
    title: 'Verify Email | Dreambounty',
    msg: 'Email Verified',
    submsg: 'Your email has been verified.'
  })
})

// resend
accept.post('/:id/resend', bouncer.recipientOnly, ratelimit.resend, async (req, res, next) => {
  const username = req.session.username
  const id = req.params.id

  // validation
  let { current_step } = await knex.select('current_step').from('requests').where({id}).first()
  if (current_step !== 'verified') return next(err(403,`User tried to access a step that isn't the current step.`))

  // (verified in this context meaning email verified timestamp as opposed to users.verified badge)
  let { verified, email } = await knex.select(
    'requests.verified',
    'users.email')
    .from('requests')
    .innerJoin('users', 'users.username', knex.raw('?', [username]))
    .where({id})
    .first()

  if (verified) return res.redirect(`/accept/${id}`)

  const token = await generateId(36)
  await knex('requests').update({token,token_created:'now()'}).where({id})

  await mailer({
    to: email,
    subject: 'Please Verify Your Email',
    message: [ 'Click the link below to verify your email:',`${url}/accept/${token}/${id}` ]
  })

  req.session.flash = 'Another email has just been sent to you.'
  req.session.save(() => res.redirect(`/accept/${id}`))
})

// accept
accept.post('/:id/accept', bouncer.recipientOnly, async (req, res, next) => {
  const username = req.session.username
  const id = req.params.id
  const update = req.body.update
  const checked = req.body.checked

  // validation
  if (!checked) {
    req.session.flash = 'You have to agree to the Terms of Use before continuing.'
    return req.session.save(() => res.redirect(`/accept/${id}`))
  }
  let { current_step, title, raised } = await knex.select('current_step','title','raised').from('requests').where({id}).first()
  if (current_step !== 'accepted') return next(err(403,`User tried to access a step that isn't the current step.`))
  if ([update].includes(undefined)) return next(err(400,`Undefined parameters.`))

  // get the user's email
  const { email } = await knex.select('email').from('users').where({username}).first()

  // validate update
  if (update.length >= 50000) {
    req.session.flash = 'Updates must be less than 50,000 characters.'
    return req.session.save(() => res.redirect(`/${id}`))
  }

  await knex('requests').update({accepted:'now()',current_step:null}).where({id})

  // track accepted request
  req.session.event = JSON.stringify({
    ec: 'Request Event',
    ea: 'Request Accepted',
    el: `$${raised}: ${title}`
  })

  // insert update
  for (let i=0;i<1000;i++) {
    const update_id = await generateId(7)
    const [e] = await to(knex('updates').insert({update_id, id, update}))

    if (!e) break
    if (i >= 999) return next(err(500, 'Failed to insert update after 999 iterations.'))
    if (e && e.code === '23505' && e.constraint === 'requests_pkey') continue
    if (e) return next(e)
  }

  // payout
  const stats = await payout(id)

  // send successful payout email to platform
  await mailer({
    subject: `A request was accepted by ${username}`,
    message: [
      `Email of recipient: ${email}`,
      `Request: ${title}`,
      'Payout stats:',
      `Number of backers: ${stats.backersCount}`,
      `Number of successful tokenizations: ${stats.tokensCount}`,
      `Number of failed tokenizations: ${stats.failedTokensCount}`,
      `Reasons for failed tokenizations: ${stats.failedTokens}`,
      `Number of successful charges: ${stats.chargesCount}`,
      `Number of failed charges: ${stats.failedChargesCount}`,
      `Reasons for failed charges: ${stats.failedCharges}`,
      `The sum final amount paid to the creator: $${stats.sumTotalPaid}`
    ]
  })

  // send successful payout email to creator
  await mailer({
    to: email,
    subject: 'Request successfully accepted',
    message: [
      title,
      'You have successfully accepted the request and have been paid by your backers. Check your Stripe dashboard for a full breakdown of all charges and fees.',
      'If you have any questions you can contact us at: dreambountyapp@gmail.com'
    ]
  })

  res.redirect(`/accept/${id}`)
})

module.exports = accept
