const request = require('request')
const rp = require('request-promise')
const qs = require('querystring')
const err = require('./err')
const url = process.env.NODE_ENV === 'development' ? process.env.DEV_URL : process.env.URL
const consumerKey = process.env.NODE_ENV === 'development' ? process.env.DEV_TWITTER_CONSUMER_KEY : process.env.TWITTER_CONSUMER_KEY
const consumerSecret = process.env.NODE_ENV === 'development' ? process.env.DEV_TWITTER_CONSUMER_SECRET : process.env.TWITTER_CONSUMER_SECRET

const twitterRedirect = async (req, res, force_login) => {
  const forceLogin = force_login ? '&force_login=true' : ''

  /* Get request tokens from Twitter that you'll use
  later in the url you redirect users to. */
  const requestTokens = qs.parse(await rp({ method: 'post', uri: 'https://api.twitter.com/oauth/request_token', oauth: {
    callback: `${url}/callback`,
    consumer_key: consumerKey,
    consumer_secret: consumerSecret
  }}))

  /* This simply confirms that Twitter knows where
  to redirect users upon access granted. */
  if (requestTokens.oauth_callback_confirmed !== 'true') return next(err(403,`'oauth_callback_confirmed' property wasn't true.`))

  /* Temporarily store the request tokens because
  you'll need to use them later. */
  req.session.tokens = {}
  req.session.tokens.oauthRequestToken = requestTokens.oauth_token
  req.session.tokens.oauthRequestTokenSecret = requestTokens.oauth_token_secret

  /* Redirect the user to Twitter so they can login
  and grant your app access to their account. */
  req.session.save(() => res.redirect(302,`https://api.twitter.com/oauth/authenticate?oauth_token=${requestTokens.oauth_token}${forceLogin}`))
}

/* Upon success Twitter will redirect the user
back and this twitterCallback function will be
called. */
const twitterCallback = async (req, res, next) => {

  /* The callback url includes two parameters,
  the request token and the oauth_verifier key. */
  const requestTokens = req.query

  /* Check to make sure the request token
  in the callback is the same as the one
  received in the first step. */
  if (req.session.tokens.oauthRequestToken !== requestTokens.oauth_token) return next(err(403,'Request token in the callback mismatches the one received in the first step.'))

  /* Use everything below to generate the final
  access tokens that you'll use to make all
  future authenticated requests to Twitter. */
  const accessTokens = qs.parse(await rp({ method: 'post', uri: 'https://api.twitter.com/oauth/access_token', oauth: {
    consumer_key: consumerKey,
    consumer_secret: consumerSecret,
    token: requestTokens.oauth_token,
    token_secret: req.session.tokens.oauthRequestTokenSecret,
    verifier: requestTokens.oauth_verifier
  }}))

  /* Temporarily store the generated access tokens
  in user's session. */
  req.session.tokens.oauthAccessToken = accessTokens.oauth_token
  req.session.tokens.oauthAccessTokenSecret = accessTokens.oauth_token_secret

  /* Use the access tokens to get all the info
  about the user's account and return it. */
  return rp({ uri: 'https://api.twitter.com/1.1/account/verify_credentials.json?include_email=true', oauth: {
    consumer_key: consumerKey,
    consumer_secret: consumerSecret,
    token: accessTokens.oauth_token,
    token_secret: accessTokens.oauth_token_secret
  },json: true})
}

exports.twitterRedirect = twitterRedirect
exports.twitterCallback = twitterCallback
