const knex = require('knex')(require('./database')())
const stripe = require('stripe')(process.env.STRIPE_TEST_KEY)
const rp = require('request-promise')

// get user's card
const getCard = async username => {
  const { customer_id } = await knex.select('customer_id').from('users').where({username}).first()
  if (!customer_id) return [null,null]
  const customer = await stripe.customers.retrieve(customer_id)
  const email = customer.email
  const card = customer.sources.data.filter(source => source.object === 'card')[0]
  if (!card) return [null,email]
  return [card,email]
}

// disconnect stripe account
const disconnectStripeAccount = async req => {
  const username = req.session.username
  const { stripe_account } = await knex.select('stripe_account').from('users').where({username}).first()
  if (!stripe_account) throw err(400,`User tried to access disconnect stripe account resource without having a stripe account.`)

  // disconnect connected account from the platform
  const result = await rp({
    uri: 'https://connect.stripe.com/oauth/deauthorize',
    method: 'post',
    formData: {
      client_id: process.env.STRIPE_CLIENT_ID,
      stripe_user_id: stripe_account
    },
    headers: {'Authorization': `Bearer ${process.env.STRIPE_TEST_KEY}`}
  })

  // remove user's stripe account id
  await knex('users').update({stripe_account:null}).where({username})
}


exports.getCard = getCard
exports.disconnectStripeAccount = disconnectStripeAccount
