const knex = require('knex')(require('./database')())
const stripe = require('stripe')(process.env.STRIPE_TEST_KEY)
const Promise = require('bluebird')
const dev = process.env.NODE_ENV === 'development'

module.exports = async id => {

  // stats
  const stats = {
    backersCount: 0, // number of backers
    tokensCount: 0, // number of successful tokenizations
    failedTokensCount: 0, // number of failed tokenizations
    failedTokens: [], // reasons for failed tokenizations
    chargesCount: 0, // number of successful charges
    failedChargesCount: 0, // number of failed charges
    failedCharges: [], // reasons for failed charges
    sumTotalPaid: 0 // the sum final amount paid to the creator
  }

  // get request recipient's stripe account
  const { recipient } = await knex.select('recipient').from('requests').where({ id }).first()
  const { stripe_account } = await knex.select('stripe_account').from('users').where({username:recipient}).first()

  // get backers' contributions and customer ids
  const backers = await knex.select(
    'users.username',
    'users.customer_id',
    'backers.contribution')
    .from('backers')
    .innerJoin('users', 'users.username','backers.username')
    .where('backers.id',id)

  // stats: set total number of backers
  stats.backersCount = backers.length

  // push tokenization promises to array
  backers.forEach(backer => {
    backer.token = stripe.tokens.create({
      customer: backer.customer_id,
    }, { stripe_account })
  })

  // tokenize, continuing even if some fail
  await Promise.all(backers.map(backer => {
    return backer.token.reflect()
  })).each((token,i) => {
    if (token.isFulfilled()) {
      stats.tokensCount++
      const value = token.value()
      backers[i].token = value.id
    } else {
      stats.failedTokensCount++
      stats.failedTokens.push(token.reason())
      delete backers[i]
    }
  })

  // push charge promises to array
  const charges = []
  backers.forEach(backer => {
    charges.push(stripe.charges.create({
      amount: backer.contribution * 100,
      currency: 'usd',
      description: `${id}: Contribution from ${backer.username}`,
      source: backer.token,
      application_fee: 0.05 * (backer.contribution * 100)
    }, { stripe_account }))
  })

  // charge backers, continuing even if some fail
  await Promise.all(charges.map(charge => {
    return charge.reflect()
  })).each((charge,i) => {
    if (charge.isFulfilled()) {
      stats.chargesCount++
      stats.sumTotalPaid = stats.sumTotalPaid + backers[i].contribution
    } else {
      stats.failedChargesCount++
      stats.failedCharges.push(charge.reason())
    }
  })

  return stats

}
