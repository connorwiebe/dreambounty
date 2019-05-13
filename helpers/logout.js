
module.exports = async (req, res) => {

  let redirect = req.body.url || '/'
  if (redirect.includes('/accept') || ['/create','/settings'].includes(redirect)) redirect = '/'

  if (req.session.username) {
    return req.session.destroy(() => {
      res.redirect(redirect)
    })
  }
  res.redirect(redirect)
}
