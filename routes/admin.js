const admin = require('express-promise-router')()
const err = require('../helpers/err')
const knex = require('knex')(require('../helpers/database')())
const mailer = require('../helpers/mailer')
const url = process.env.NODE_ENV === 'development' ? process.env.DEV_URL : process.env.URL

// restricts routes to admins only
const adminOnly = (req, res, next) => {
  if (req.session.username !== 'connorwiebe11') return next(err(404,'Client tried to access an admin only route.'))
  next()
}

// approve or reject a request
admin.get('/approve/:id/:bool', adminOnly, async (req, res, next) => {
  const { id, bool } = req.params
  const approved = bool === 'true'

  // validation
  const request = await knex.select('id','title','author').from('requests').whereNull('approved').andWhere({id}).first()
  if (!request) return next()

  // update
  await knex('requests').where({id}).update({approved})

  if (!approved) {
    const { email } = await knex.select('email').from('users').where({username:request.author}).first()
    await mailer({
      to: email,
      subject: 'Your request was rejected.',
      message: [
        request.title,
        'Your request was rejected because it violates our community guidelines. Please review the guidelines before creating another request.',
        `${url}/legal#things-you-definitely-shouldnt-do`
      ]
    })
  }
  res.end()
})

// authorize or reject a recipient's application to accept a request
admin.get('/authorize/:id/:bool', adminOnly, async (req, res, next) => {
  const { id, bool } = req.params
  const authorized = bool === 'true'

  // validation
  const request = await knex.select('id','recipient','title').from('requests').where({id}).first()
  if (!request) return next()
  const { current_step } = await knex.select('current_step').from('requests').where({id}).first()
  if (current_step !== 'authorized') return next(err(400,`Can't authorize a request that isn't in the 'authorized' step.`))

  // authorize
  if (authorized) {

    // update
    await knex('requests').where({id}).update({current_step:'accepted',authorized:true})

    // send email
    const { email } = await knex.select('email').from('users').where({username:request.recipient}).first()
    await mailer({
      to: email,
      subject: 'Your request was approved.',
      message: [
        request.title,
        'Your request was approved and you can now accept it.',
        `${url}/accept/${id}`
      ]
    })

  // reject, reset everything (send personal email, not automated, if you reject here.)
  } else {
    await knex('requests').where({id}).update({
      current_step:'reauth',
      reauth:null,
      verified:null
    })
  }

  res.end()
})

module.exports = admin
