const request = require('express-promise-router')()
const moment = require('moment')
const bouncer = require('../helpers/bouncer')
const knex = require('knex')(require('../helpers/database')())
const err = require('../helpers/err')
const to = require('../helpers/to')
const old = require('../helpers/old')
const accounting = require('../helpers/accounting')
const generateId = require('crypto-alphanumeric-id')
const url = process.env.NODE_ENV === 'development' ? process.env.DEV_URL : process.env.URL

// get request
request.get('/:id', async (req, res, next) => {
  const id = req.params.id
  const username = req.session.username || null

  // get request
  let request = await knex.select(
    'requests.title',
    'requests.author',
    'requests.recipient',
    'requests.backers',
    'requests.raised',
    'requests.approved',
    'requests.created as requestCreated',
    'requests.authorized',
    'requests.accepted',
    'users.avatar',
    'users.name',
    'users.username',
    'users.verified',
    'backers.created as userCreated',
    'backers.contribution')
    .from('requests')
    .innerJoin('users','requests.recipient','users.username')
    .leftJoin('backers', function () {
      this.on('backers.username',knex.raw('?', [username])).andOn('backers.id','requests.id')
    })
    .where('requests.approved', true)
    .andWhere('requests.id', id)
    .orWhereNull('requests.approved')
    .andWhere('requests.id', id)
    .first()

  // 404 if no request is found
  if (!request) return next()

  // set misc boolean flags
  const isRegistered = (!!username).toString()
  const isRecipient = request.recipient === username
  const isAuthorized = request.authorized
  const isApproved = request.approved
  const isAccepted = request.accepted
  const isAuthor = request.author === username
  const canDelete = isAuthor && request.backers < 5 && !isAccepted
  const canAccept = isRecipient && !isAccepted
  const canPostUpdates = isRecipient && isAccepted

  // get backers
  let backers = await getBackers(id,username,0)
  if (backers.length >= 10) backers.pop()

  // format timestamps
  request.date = moment(request.requestCreated).format('MMM. D, YYYY').toUpperCase() //h:mmA -
  if (request.contribution) request.created = moment(request.userCreated).fromNow()
  backers.forEach(backer => {
    backer.created = moment(backer.created).fromNow()
  })
  request.since = moment(request.requestCreated).fromNow().slice(0,-4)

  // get the updates
  let updates = []
  let acceptedDate = ''
  if (isAccepted) {
    acceptedDate = moment(request.accepted).format('MMMM D, YYYY')
    updates = await knex.select('update_id','update','created').from('updates').where({id}).orderBy('created', 'desc')
    updates.forEach(update => {
      update.created = moment(update.created).format('MMM D, YYYY') //h:mma -
    })
  }

  // render
  res.render('request', {
    title: `${request.title} | Dreambounty`,
    avatar: res.locals.user ? res.locals.user.avatar : 'images/placeholder.svg',
    request,
    backers,
    updates,
    acceptedDate,
    isRegistered,
    isAccepted,
    isRecipient,
    canDelete,
    canAccept,
    canPostUpdates
  })
})

// contributon
request.post('/:id/contribute', bouncer.usersOnly, async (req, res, next) => {
  const username = req.session.username
  const contribution = req.body.contribution
  const id = req.params.id

  // validation
  const [card,email] = await accounting.getCard(username)
  if (!card) return res.json({err:'You have to add a credit or debit card in your settings to contribute.'})
  if ([contribution].includes(undefined)) return next(err(400,'Undefined parameters.'))
  if (contribution > 99 || contribution < 0) return next(err(400, 'Contribution length failed validation.'))
  const { approved, accepted } = await knex.select('approved','accepted').from('requests').where({id}).first() || {}
  if ([approved,accepted].includes(undefined)) return next(err(400,'Undefined parameters.'))
  if (!approved) return res.json({err:'Please wait until this request is approved before contributing.'})
  if (accepted) return next(err(403, 'User tried to contribute to an accepted request.'))

  // insert
  const [e] = await to(knex('backers').insert({ username, id, contribution }))
  if (e) {
    // user already has contribution, just delete or update
    if (e.code === '23505' && e.constraint === 'backers_pkey') {
      // delete
      if (+contribution === 0) {
        const result = await knex('backers').where({username,id}).del()
      } else {
        // update
        /* Otherwise update the contribution to the new amount and update the created time.
        Check difference and only update created column if difference is greater than one hour
        to prevent abuse (incrementally updating to stay at top of backers list). */
        const backer = await knex.select('created').from('backers').where({username}).andWhere({id}).first()
        if (old(backer.created, '>', '1h')) {
          await knex('backers').where({username,id}).update({ contribution, created: 'now()' })
        } else {
          await knex('backers').where({username,id}).update({ contribution })
        }
      }
    } else {
      return next(e)
    }
  }
  const totals = await knex.select('raised','backers').from('requests').where({id}).first()
  res.json({totals})
})

// delete request
request.delete('/:id/delete', bouncer.usersOnly, async (req, res, next) => {
  const username = req.session.username
  const id = req.params.id
  const request = await knex.select('author','backers','approved').from('requests').where({id}).first()

  // validate
  if ([request].includes(undefined)) return next(err(400,'Undefined parameters.'))
  if (request.author !== username || request.backers >= 5) return next(err(403,`User that isn't author tried to delete request or request has 5 or more backers.`))
  if (request.approved === false) return next(err(403,'Author tried to delete request that has been rejected.'))
  await knex('requests').where({id}).del()
  res.end()
})

// function for pagination (filtering out user's contribution)
async function getBackers (id,username,offset) {
  return await knex.select(
  'backers.contribution',
  'backers.created',
  'users.username',
  'users.avatar')
  .from('backers')
  .innerJoin('users','backers.username','users.username')
  .whereNotNull('users.email')
  .andWhere('backers.id',id)
  .whereNot('backers.username',username)
  .orderBy('backers.created', 'desc')
  .offset(offset)
  .limit(11)
}

// delete update
request.delete('/:id/delete_update', bouncer.recipientOnly, async (req, res, next) => {
  const updateId = req.body.updateId
  if ([updateId].includes(undefined)) return next(err(400,'Undefined parameters.'))
  const update = await knex('updates').where({update_id:updateId}).del()
  res.end()
})

// create update
request.post('/:id/update', bouncer.recipientOnly, async (req, res, next) => {
  const username = req.session.username
  const update = req.body.update
  const id = req.params.id

  // get all the user's updates for this request
  const updates = await knex.select('update').from('updates').where({id})

  // validate update
  if ([update].includes(undefined)) return next(err(400,'Undefined parameters.'))
  const { accepted } = await knex.select('accepted').from('requests').where({id}).first()
  if (!accepted) return next(err(403, `Recipient tried to post update to a request that isn't accepted yet.`))
  if (updates.length >= 10) return res.json({err: 'You can only create 10 updates.'})
  if (update.length >= 50000) return res.json({err: 'Updates must be less than 50,000 characters.'})

  // insert update
  for (let i=0;i<1000;i++) {
    const update_id = await generateId(11)
    const [e] = await to(knex('updates').insert({update_id, id, update}))

    if (!e) break
    if (i === 999) return next(err(500, 'Failed to insert update after 999 iterations.'))
    if (e && e.code === '23505' && e.constraint === 'requests_pkey') continue
    if (e) return next(e)
  }

  res.json({})
})

module.exports = request
