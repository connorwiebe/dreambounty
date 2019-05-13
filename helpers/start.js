const oauth = require('./oauth')
const knex = require('knex')(require('./database')())
const generateId = require('crypto-alphanumeric-id')
const moment = require('moment')
const err = require('./err')
const old = require('./old')

// init session and redirect to twitter
const redirect = async (req, res) => {
  req.session.redirect = req.body.url ? req.body.url : '/'
  await oauth.twitterRedirect(req, res, false)
}

// login success
const callback = async (req, res, next) => {

  // validation
  if (!req.session.tokens) return next(err(400,`User without tokens attempted to access Twitter callback.`))

  // get user's twitter info
  const twitter = await oauth.twitterCallback(req, res, next)

  // check if user is banned, account is over two weeks old and has email
  const createdAt = moment(twitter.created_at, 'ddd MMM DD HH:mm:ss Z YYYY').valueOf()
  const difference = Date.now() - createdAt
  const banned = await knex.select('username').from('banned').where({ username: twitter.screen_name }).first()
  if (banned || difference < 1210000000 || !twitter.email) {

    // clean up, set flash and redirect
    const redirect = req.session.redirect
    delete req.session.redirect
    delete req.session.tokens
    req.session.flash = `Your Twitter account has to be over two weeks old before you join.`
    if (!twitter.email) req.session.flash = `Your Twitter account must have an email address associated with it.`
    if (banned) req.session.flash = `Your Twitter account is banned. Contact us if you think this was a mistake.`
    req.session.pin = 'true'
    return req.session.save(() => res.redirect(redirect))
  }

  // user data
  const user = {
    twitter_id: twitter.id_str,
    username: twitter.screen_name,
    name: twitter.name,
    email: twitter.email,
    verified: twitter.verified,
    avatar: twitter.profile_image_url_https.replace('_normal',''),
    followers: twitter.followers_count,
    tweets: twitter.statuses_count,
    username: twitter.screen_name,
    oauth_token: req.session.tokens.oauthAccessToken,
    oauth_token_secret: req.session.tokens.oauthAccessTokenSecret
  }

  // insert
  try {
    await knex('users').insert(user)

    // add uid for google analytics
    const generateUid = async () => {
      const newUid = await generateId(7)
      const { uid } = await knex.select('uid').from('users').where({uid:newUid}).first() || {}
      if (uid) return generateUid()
      return newUid
    }
    const uid = await generateUid()
    await knex('users').where({username:user.username}).update({uid})

    // track account creation event
    req.session.event = JSON.stringify({
      ec: 'Account Event',
      ea: 'Account Created'
    })

  } catch (err) {
    if (err.code === '23505' && err.constraint === 'users_pkey') {
      // update
      await knex('users').where({username:user.username}).update(user)
    } else {
      return next(err)
    }
  }

  // set session properties
  const { username, name, avatar } = user
  req.session.user = { name, avatar }
  req.session.username = username
  req.session.csrf = await generateId(36)
  const { uid } = await knex.select('uid').from('users').where({username}).first()
  req.session.uid = uid

  // reauth
  if (req.session.reauth && old(req.session.reauth, '<', '1m')) {
    req.session.reauth = true
  } else {
    delete req.session.reauth
  }

  // clean up and redirect
  const redirect = req.session.redirect
  delete req.session.redirect
  delete req.session.tokens
  req.session.save(() => res.redirect(redirect))

}

exports.redirect = redirect
exports.callback = callback
