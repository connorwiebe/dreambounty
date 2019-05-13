const isJSON = require('is-json')

// get
const get = key => {
  let result
  result = localStorage.getItem(key)
  if (isJSON(result)) result = JSON.parse(result)
  return result
}

// set
const set = (key, value) => {
  if (typeof value === 'object') value = JSON.stringify(value)
  return localStorage.setItem(key, value)
}

// del
const del = key => {
  return localStorage.removeItem(key)
}

exports.get = get
exports.set = set
exports.del = del
