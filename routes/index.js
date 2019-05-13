const index = require('express-promise-router')()
const knex = require('knex')(require('../helpers/database')())
const formatNum = require('format-num')
const pug = require('pug')
const err = require('../helpers/err')

// get
index.get('/', async (req, res) => {
  const username = req.session.username || null
  const contribution = knex.select('contribution').from('backers').where('backers.username',username).whereRaw('backers.id = requests.id').as('contribution')
  let requests = await knex.select(
    'requests.id',
    'requests.title',
    'requests.backers',
    'requests.raised',
    'requests.accepted',
    'users.username',
    'users.name',
    'users.avatar',
    'users.verified',
    contribution)
    .from('requests')
    .innerJoin('users','requests.recipient','users.username')
    .where('requests.approved',true)
    .orderBy('requests.raised','desc')
    .limit(24)
    requests.forEach(request => {
      request.raised = formatNum(request.raised)
    })
  res.render('index', {
    requests,
    title: 'Dreambounty',
    description: 'Dreambounty is a platform for crowdfunding specific content that you’d like to see content creators produce.'
  })
})

// search
index.get('/search', async (req, res, next) => {
  const username = req.session.username || null
  const query = req.query.q
  if ([query].includes(undefined)) return next(err(400,`Undefined parameters.`))
  const contribution = knex.select('contribution').from('backers').where('backers.username',username).whereRaw('backers.id = requests.id').as('contribution')

  const requests = await knex.select(
  'requests.id',
  'requests.title',
  'requests.backers',
  'requests.raised',
  'requests.accepted',
  'users.username',
  'users.name',
  'users.avatar',
  'users.verified',
  contribution)
  .from('requests')
  .innerJoin('users','requests.recipient','users.username')
  .where('requests.approved', true)
  .andWhere(function () {
    this.where('requests.title', 'ilike', `%${query}%`)
    .orWhere('users.name', 'ilike', `%${query}%`)
    .orWhere('users.username', 'ilike', `%${query}%`)
  })
  .orderBy('requests.raised','desc')
  .limit(10)

  const results = pug.renderFile('./views/_requests.pug', { requests })
  res.send(results)
})

module.exports = index
