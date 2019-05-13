const moment = require('moment')
const err = require('./err')
const h = require('parse-duration')

module.exports = (a, b, c) => {
  const created = moment(a).valueOf()
  const comparison = h(c)
  const now = Date.now()
  const difference = now - created
  if (b === '>') return difference > comparison
  if (b === '<') return difference < comparison
}
