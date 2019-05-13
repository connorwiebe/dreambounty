const user = require('express-promise-router')()
const knex = require('knex')(require('../helpers/database')())
const err = require('../helpers/err')
const pug = require('pug')
const to = require('../helpers/to')

user.get('/:paramsUsername', async (req, res, next) => {
  const username = req.session.username
  const paramsUsername = req.params.paramsUsername
  const isOwner = username === paramsUsername

  // make sure user exists
  const paramsUser = await knex.select('username','name','avatar','verified','email').from('users').where({username:paramsUsername}).first()
  if (!paramsUser) return next()

  // if user hasn't registered and check if they have any approved requests and if not 404
  if (!paramsUser.email) {
    const requests = await knex.select('id')
      .from('requests')
      .where({recipient:paramsUsername})
      .andWhere({approved:true})
      .first()
    if (!requests) return next()
  }

  // You will have to paginate requests/backing/created so requestCount won't return total requests and total backing, only total where .length(n)
  // const contributionsCount = knex.raw('sum(backers.contribution) OVER() AS contributions_count')
  // get total totals
  // const { totalRequests } = await knex('backers').count('username as totalRequests').where({username:paramsUsername}).first()

  // const { totalContributions } = await knex('backers').sum('contribution as totalContributions').where({username:paramsUsername}).first()

  // get init requests
  const requests = await getTab('recipient', 'popular', username, paramsUsername)

  // render
  res.render('user', {
    title: `${paramsUser.name} | Dreambounty`,
    paramsUser,
    requests,
    isOwner
  })
})


// get tab
user.get('/:paramsUsername/tab', async (req, res, next) => {
  const username = req.session.username
  const paramsUsername = req.params.paramsUsername
  const type = req.query.type || 'recipient'
  const sort = req.query.sort || 'popular'

  // make sure user exists
  const paramsUser = await knex.select('username','name','avatar','verified','email').from('users').where({username:paramsUsername}).first()
  if (!paramsUser) return next()

  // if user hasn't registered and if they have any approved requests and if not 404
  if (!paramsUser.email) {
    const requests = await knex.select('id').from('requests').where({recipient:paramsUsername}).andWhere({approved:true}).first()
    if (!requests) return next()
  }

  // get and send requests
  let [e, requests] = await to(getTab(type, sort, username, paramsUsername))
  if (e) return next(e)
  requests = pug.renderFile('./views/_user_requests.pug', { requests, isOwner: username === paramsUsername })
  res.send(requests)
})


// get requests for a given tab
async function getTab (type, sort, username, paramsUsername) {

  // validation
  if (!['recipient','backed','created'].includes(type)) throw err(400,`Invalid parameters.`)
  if (!['popular','recent'].includes(sort)) throw err(400,`Invalid parameters.`)

  const requestsCount = knex.raw('count(requests.id) OVER() AS requests_count')

  // recipient
  if (type === 'recipient') {
    return await knex.select(
      'requests.id',
      'requests.title',
      'requests.raised',
      'requests.accepted',
      'users.verified',
      'users.name',
      'users.username',
      'users.avatar',
      'backers.contribution',
      requestsCount)
      .from('requests')
      .innerJoin('users', 'requests.recipient', 'users.username')
      .leftJoin('backers', function () {
        this.on('backers.username',knex.raw('?',[paramsUsername])).andOn('backers.id','requests.id')
      })
      .where('requests.recipient',paramsUsername)
      .andWhere('requests.approved', true)
      .orderBy(sort === 'popular' ? 'requests.raised' : 'requests.created', 'desc')
      .limit(10)
  }

  // backed
  if (type === 'backed') {
    return await knex.select(
      'requests.id',
      'requests.title',
      'requests.raised',
      'requests.accepted',
      'users.verified',
      'users.name',
      'users.username',
      'users.avatar',
      'backers.contribution',
      requestsCount)
      .from('requests')
      .innerJoin('users', 'requests.recipient', 'users.username')
      .innerJoin('backers', function () {
        this.on('backers.username',knex.raw('?',[paramsUsername])).andOn('backers.id','requests.id')
      })
      .where('requests.approved', true)
      .orderBy(sort === 'popular' ? 'requests.raised' : 'requests.created', 'desc')
      .limit(10)
  }

  // created
  if (type === 'created') {
    const isOwner = username === paramsUsername
    const columns = [
      'requests.id',
      'requests.title',
      'requests.raised',
      'requests.accepted',
      'users.verified',
      'users.name',
      'users.username',
      'users.avatar',
      requestsCount
    ]
    if (isOwner) columns.push('backers.contribution')
    return knex.select(columns)
      .from('users')
      .innerJoin('requests', function () {
        this.on('requests.recipient','users.username').andOn('requests.author', knex.raw('?',[paramsUsername]))
      })
      .modify(query => {
        if (isOwner) {
          query.leftJoin('backers', function () {
            this.on('backers.username',knex.raw('?',[paramsUsername])).andOn('backers.id','requests.id')
          })
          query.where('requests.approved', true).orWhereNull('requests.approved')
        } else {
          query.whereNotNull('requests.approved').andWhereNot('requests.approved', false)
        }
      })
      .orderBy(sort === 'popular' ? 'requests.raised' : 'requests.created', 'desc')
      .limit(10)
  }
}

module.exports = user
