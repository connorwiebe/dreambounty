const client = require('./client')
const isJSON = require('is-json')

// get
const get = async key => {
  let result
  result = await client.getAsync(key)
  if (isJSON(result)) result = JSON.parse(result)
  return result
}

// set
const set = async (key, value) => {
  if (typeof value === 'object') value = JSON.stringify(value)
  return await client.setAsync(key, value)
}

// setex
const setex = async (key, value, expire) => {
  if (typeof value === 'object') value = JSON.stringify(value)
  return await client.setAsync(key, value, 'ex', expire)
}

// del
const del = async key => {
  return await client.delAsync(key)
}

exports.get = get
exports.set = set
exports.setex = setex
exports.del = del
