const Promise = require('bluebird')
const redis = Promise.promisifyAll(require('redis'))
const options = process.env.NODE_ENV === 'development' ? {} : { url: process.env.REDIS_URL }
module.exports = redis.createClient(options)
