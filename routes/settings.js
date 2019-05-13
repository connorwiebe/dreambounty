const settings = require('express-promise-router')()
const bouncer = require('../helpers/bouncer')
const rp = require('request-promise')
const err = require('../helpers/err')
const accounting = require('../helpers/accounting')
const knex = require('knex')(require('../helpers/database')())
const stripe = require('stripe')(process.env.STRIPE_TEST_KEY)

// restricts routes to logged in users only
settings.use(bouncer.usersOnly)

// get settings
settings.get('/', async (req, res, next) => {
  const username = req.session.username
  const { stripe_account, verified } = await knex.select('stripe_account', 'verified').from('users').where({username}).first()
  const { count } = await knex('requests').where({recipient:username}).count('id').first()

  // get card
  const [card,email] = await accounting.getCard(username)

  const customers = {
    card: {
      brand: card ? card.brand.replace(/\s/g, '').toLowerCase() : 'unknown',
      last4: card ? card.last4 : ''
    },
    email: email ? email : ''
  }

  // render
  res.render('settings', {
    settings,
    customers,
    verified,
    hasRequests: !!count,
    hasStripeAccount: stripe_account
  })
})

// add card
settings.post('/add_card', async (req, res, next) => {
  const username = req.session.username
  const token = req.body.token
  if ([token].includes(undefined)) return next(err(400,`Undefined parameters.`))
  const { customer_id } = await knex.select('customer_id').from('users').where({username}).first()

  // if customer doesn't exist, create customer with card, email and address
  if (!customer_id) {
    const customer = await stripe.customers.create({ source:token.id, email:token.email })
    await knex('users').where({username}).update({customer_id: customer.id})
    return res.end()
  }

  // if customer exists, delete card if exists and add new card
  const customer = await stripe.customers.retrieve(customer_id)
  const card = customer.sources.data.filter(source => source.object === 'card')[0]
  if (card) await stripe.customers.deleteCard(customer_id,card.id)
  await stripe.customers.createSource(customer_id,{source:token.id})
  res.end()
})

// delete card
settings.delete('/delete_card', async (req, res, next) => {
  const username = req.session.username

  // delete card
  const { customer_id } = await knex.select('customer_id').from('users').where({username}).first()
  const customer = await stripe.customers.retrieve(customer_id)
  const card = customer.sources.data.filter(source => source.object === 'card')[0]
  await stripe.customers.deleteCard(customer_id, card.id)

  // delete all backers rows where request isn't accepted
  /* updates and deletes with joins ('using') aren't supported by knex yet (https://github.com/tgriesser/knex/issues/2543) */
  await knex.raw('delete from backers using requests where backers.id = requests.id and requests.accepted is null and backers.username = ?', [username])

  res.end()
})

// add stripe account with oauth dance
settings.get('/stripe_callback', async (req, res, next) => {
  const username = req.session.username
  if (req.session.csrf !== req.query.state) return next(err(403, 'Invalid CSRF token.'))
  if (req.query.error) return next(err(400,`${req.query.error}: ${req.query.error_description}`))
  const uri = `https://connect.stripe.com/oauth/token?client_secret=${process.env.STRIPE_TEST_KEY}&code=${req.query.code}&grant_type=authorization_code`
  const result = await rp({ uri, method: 'post', json: true })
  if (result.error) return next(err(400,`${result.error}: ${result.error_description}`))
  await knex('users').where({ username }).update({ stripe_account: result.stripe_user_id })
  res.redirect('/settings')
})

// disconnect stripe account
settings.delete('/disconnect_stripe', async (req, res, next) => {
  await accounting.disconnectStripeAccount(req)
  res.end()
})

// delete account
settings.delete('/delete_account', async (req, res, next) => {
  const username = req.session.username
  // delete customer id and disconnect stripe account if exists
  const { customer_id, stripe_account } = await knex.select('customer_id','stripe_account').from('users').where({username}).first()
  if (customer_id) await stripe.customers.del(customer_id)
  if (stripe_account) await accounting.disconnectStripeAccount(req)
  // delete requests where backers < 5 and not accepted
  await knex('requests').whereNull('accepted').where('author', username).andWhere('backers', '<', 5).del()
  // delete user's backers rows where request isn't accepted
  await knex.raw('delete from backers using requests where backers.id = requests.id and requests.accepted is null and backers.username = ?', [username])
  // soft delete user
  await knex('users').where({username}).update({email:null,customer_id:null,oauth_token:null,oauth_token_secret:null})
  // destroy session
  return req.session.destroy(() => res.end())
})


module.exports = settings
