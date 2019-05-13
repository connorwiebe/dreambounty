module.exports = (req, res, next) => {

  // flash settings
  if (req.session.flash) {
    res.locals.flash = req.session.flash
    delete req.session.flash
  }

  if (req.session.pin) {
    res.locals.pin = req.session.pin
    delete req.session.pin
  }

  if (req.session.action) {
    res.locals.action = req.session.action
    delete req.session.action
  }

  // server side google analytics event
  if (req.session.event) {
    res.locals.event = req.session.event
    delete req.session.event
  }

  // set default locals for every get request
  res.locals.username = req.session.username
  res.locals.user = req.session.user
  res.locals.url = req.url
  res.locals.dev = process.env.NODE_ENV === 'development' ? true : false
  res.locals.gaid = process.env.NODE_ENV === 'development' ? '' : process.env.GA_ID
  res.locals.uid = req.session.uid

  next()
}
