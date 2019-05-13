// https://stackoverflow.com/questions/18264304/get-clients-real-ip-address-on-heroku#answer-37061471
module.exports = req => {
  return req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0] : undefined
}
