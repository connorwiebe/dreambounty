const Promise = require('bluebird')
const RateLimit = require('rolling-rate-limiter')
const moment = require('moment')
const client = require('./client')
const redis = require('./redis')
const err = require('./err')
const getIp = require('./ip')
const dev = process.env.NODE_ENV === 'development'

/* Global rate limit uses a rolling rate limiter library because it
has sliding windows which means users can't just wait for the current
window to end and dos all there rationed requests immediately and repeat.
All other rate limiters traditional methods. ratelimiters where users
are required to be logged in use username else user ip.*/
const globalLimit = Promise.promisify(RateLimit({
  redis: client,
  namespace: 'ratelimit:global:',
  interval: 5*60*1000, // 5 minute window
  maxInInterval: 300, // 300 requests per window (arbitrary number, fine tune this)
  minDifference: 0 // 0 ms tolerance between requests
}))
const global = async (req, res, next) => {
  const ip = getIp(req)
  if (!ip && !dev) return next(err(400, 'No ip.'))
  const timeLeft = await globalLimit(ip)
  if (timeLeft) return next(err(429, 'Global rate limit reached.'))
  next()
}

// create rate limiter
const create = async (req, res, next) => {
  const username = req.session.username

  const ratelimited = await redis.get(`ratelimit:create:${username}`)

  // rate limited, disallow request
  if (Date.now() < ratelimited) {
    req.session.flash = `Please wait ${moment(+ratelimited).fromNow().replace('in ','')} before creating another request.`
    return req.session.save(() => res.redirect('/create'))
  }

  // not rate limited, allow request
  await redis.setex(`ratelimit:create:${username}`, Date.now() + (20*60*1000), 20*60) // 20 minutes
  next()

}

// contact rate limiter
const contact = async (req, res, next) => {
  const username = req.session.username

  const ratelimited = await redis.get(`ratelimit:contact:${username}`)

  // rate limited, disallow request
  if (Date.now() < ratelimited) {
    req.session.flash = `Please wait ${moment(+ratelimited).fromNow().replace('in ','')} before contacting us again.`
    return req.session.save(() => res.redirect('/contact'))
  }

  // not rate limited, allow request
  await redis.setex(`ratelimit:contact:${username}`, Date.now() + (5*60*1000), 5*60) // 5 minutes
  next()

}

// resend rate limiter
const resend = async (req, res, next) => {
  const username = req.session.username

  const ratelimited = await redis.get(`ratelimit:resend:${username}`)

  // rate limited, disallow request
  if (Date.now() < ratelimited) {
    req.session.flash = `Please wait ${moment(+ratelimited).fromNow().replace('in ','')} before resending another email.`
    return req.session.save(() => res.redirect('back'))
  }

  // not rate limited, allow request
  await redis.setex(`ratelimit:resend:${username}`, Date.now() + (15*60*1000), 15*60) // 15 minutes
  next()

}

// you can probaby refactor these generic rate limiters

exports.global = global
exports.create = create
exports.contact = contact
exports.resend = resend
