const create = require('express-promise-router')()
const knex = require('knex')(require('../helpers/database')())
const twitter = require('../helpers/twitter')
const generateId = require('crypto-alphanumeric-id')
const bouncer = require('../helpers/bouncer')
const ratelimit = require('../helpers/ratelimit')
const err = require('../helpers/err')
const to = require('../helpers/to')
const redis = require('../helpers/redis')
const mailer = require('../helpers/mailer')
const url = process.env.NODE_ENV === 'development' ? process.env.DEV_URL : process.env.URL

// restricts routes to logged in users only
create.use(bouncer.usersOnly)

// get
create.get('/', async (req, res) => {
  const username = req.session.username
  const recipient = await redis.get(`recipient:${username}`)
  res.render('create', {
    recipient: recipient ? recipient : {},
    title: 'Create | Dreambounty',
    description: 'Make a request to your favourite content creator.'
  })
})

// search twitter
create.get('/search', async (req, res, next) => {
  const username = req.session.username
  const query = req.query.q
  if ([query].includes(undefined)) return next(err(400,`Undefined parameters.`))
  const search = await twitter.search(query,username)
  const result = search.body[0]
  if (!result) return res.json({noResults:true})
  const recipient = {
    twitter_id: result.id_str,
    username: result.screen_name,
    name: result.name,
    verified: result.verified,
    avatar: result.profile_image_url_https.replace('_normal',''),
    followers: result.followers_count,
    tweets: result.statuses_count
  }
  await redis.set(`recipient:${username}`, recipient)
  res.json(recipient)
})

// delete
create.delete('/delete', async (req, res, next) => {
  const username = req.session.username
  await redis.del(`recipient:${username}`)
  res.end()
})

// post
create.post('/', ratelimit.create, async (req, res, next) => {
  const username = req.session.username
  const { title } = req.body
  const recipient = await redis.get(`recipient:${username}`)

  // validate
  if ([title].includes(undefined)) return next(err(400,`Undefined parameters.`))
  if (title.length < 1 || title.length > 500) return next(err(400,'Create post body failed validation.'))

  const [e] = await to(knex('users').insert(recipient))
  if (e) {
    if (e && e.code === '23505' && e.constraint === 'users_pkey') {
      await knex('users').where({username:recipient.username}).update(recipient)
    } else {
      return next(e)
    }
  }

  /* 3 character base 62 string = 62³ (238,328 permutations).
  50% chance of duplicate generation at just 488 generated ids.
  You have to manually increment the id length when there is
  over the arbitrary amount of 999 consecutive collisions. */

  // insert request
  let id
  for (let i=0;i<999;i++) {
    id = await generateId(3)

    const [e] = await to(knex('requests').insert({
      id,
      author: username,
      recipient: recipient.username,
      title
      // approved: true //(for dev)
    }))

    if (!e) break
    if (i === 999) return next(err(500, 'Failed to insert request after 999 iterations.'))
    if (e && e.code === '23505' && e.constraint === 'requests_pkey') continue
    return next(e)
  }

  await mailer({
    subject: `A request was created by ${username}`,
    message: [
      title,
      `Approve the request: ${url}/admin/approve/${id}/true`,
      `Reject the request: ${url}/admin/approve/${id}/false`
    ]
  })

  await redis.del(`recipient:${username}`)

  // track newly created request
  req.session.event = JSON.stringify({
    ec: 'Request Event',
    ea: 'Request Created',
    el: title
  })

  res.redirect(`/${id}`)
})

module.exports = create
