const knex = require('knex')(require('./database')())
const rp = require('request-promise')
const consumerKey = process.env.NODE_ENV === 'development' ? process.env.DEV_TWITTER_CONSUMER_KEY : process.env.TWITTER_CONSUMER_KEY
const consumerSecret = process.env.NODE_ENV === 'development' ? process.env.DEV_TWITTER_CONSUMER_SECRET : process.env.TWITTER_CONSUMER_SECRET

const search = async (query,username) => {

  const uri = `https://api.twitter.com/1.1/users/search.json?q=${encodeURIComponent(query)}&page=1&count=10`
  const tokens = await knex.select('oauth_token','oauth_token_secret').from('users').where({username}).first()

  const oauth = {
    consumer_key: consumerKey,
    consumer_secret: consumerSecret,
    token: tokens.oauth_token,
    token_secret: tokens.oauth_token_secret
  }

  try {
    const request = await rp({uri,oauth,json:true,resolveWithFullResponse:true}) //request.headers['x-rate-limit-remaining']
    return request
  } catch (err) {
    throw err
  }

}

exports.search = search
