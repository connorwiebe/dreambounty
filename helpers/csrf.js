const err = require('./err')

module.exports = async (req, res, next) => {

  if (req.session.username) {

    // set user's csrf token to locals
    if (req.method === 'GET') {
      res.locals.csrf = req.session.csrf
      return next()
    }

    // csrf check
    if (![req.body.csrf,req.headers.csrf].includes(req.session.csrf)) {
      return next(err(403,'Invalid CSRF token.'))
    }

  }

  next()

}
