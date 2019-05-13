const expressSession = require('express-session')
const RedisStore = require('connect-redis')(expressSession)
const client = require('./client')
const prod = process.env.NODE_ENV === 'production'

module.exports = () => {
  const redisOptions = () => {
    return {
      client,
      url: prod ? process.env.REDIS_URL : null
    }
  }

  const store = new RedisStore(redisOptions())
  return expressSession({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      maxAge: 2628002880, // 1 month
      secure: prod
    },
    store
  })
}
