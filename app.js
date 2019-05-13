// load env variables
if (process.env.NODE_ENV === 'development') require('dotenv').config()

// modules
const express = require('express')
const app = express()
const bodyParser = require('body-parser')
const path = require('path')
const favicon = require('serve-favicon')
const compression = require('compression')
const helmet = require('helmet')
const status = require('statuses')
const hpp = require('hpp')

// helpers
const sessions = require('./helpers/sessions')
const csrf = require('./helpers/csrf')
const logout = require('./helpers/logout')
const start = require('./helpers/start')
const locals = require('./helpers/locals')
const ratelimit = require('./helpers/ratelimit')
const mailer = require('./helpers/mailer')
const timestamp = require('./helpers/timestamp')

// misc config
app.listen(process.env.PORT || 7777)
const dev = process.env.NODE_ENV === 'development'
const prod = process.env.NODE_ENV === 'production'
if (prod) app.use(compression({ threshold: 0 }))
if (prod) app.use(helmet())
if (prod) app.set('trust proxy', 1)
app.locals.min = prod ? '.min' : ''
app.set('view engine', 'pug')
app.set('views', path.join(__dirname, 'views'))
app.use(bodyParser.json(), bodyParser.urlencoded({ extended: false }))
app.use(hpp())

// static resources
app.use(express.static(path.join(__dirname, 'public'), { maxAge: prod ? 2628002880 : 0 })) // 1 week : 0 ms
app.use(favicon(path.join(__dirname, 'public/images/db.png')))

// middleware
app.use(sessions(), csrf, ratelimit.global)
app.post('/logout', logout)
app.post('/start', start.redirect)
app.get('/callback', start.callback)
app.get('/*', locals)

if (dev) {
  app.use((req, res, next) => {
    console.log(`${req.method} -> ${req.url}`)
    next()
  })
}

// routes
app.use('/settings',    require('./routes/settings'))
app.use('/create',      require('./routes/create'))
app.use(['/user','/u'], require('./routes/user'))
app.use('/faq',         require('./routes/faq'))
app.use('/legal',       require('./routes/legal'))
app.use('/admin',       require('./routes/admin'))
app.use('/accept',      require('./routes/accept'))
app.use('/',            require('./routes/index'))
app.use('/',            require('./routes/request'))

// error handling
app.use((req, res, next) => next({code: 404}))
app.use(async (err, req, res, next) => {

  if (dev || prod) console.error(err)
  if (err.statusCode) err.code = err.statusCode
  if (!err.code || typeof err.code !== 'number') err.code = 500
  res.status(err.code)

  if (err.code === 500 && prod) {
    const errs = Object.getOwnPropertyNames(err).map(item => err[item]).filter(item => item)
    mailer({ subject: `Server Crash: ${timestamp()}`, message: errs })
    process.exitCode = 1
  }

  res.render('err', {
    title: `${err.code} | Dreambounty`,
    msg: err.code,
    submsg: status[err.code]
  })
})
