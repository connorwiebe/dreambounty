const err = require('./err')
const knex = require('knex')(require('./database')())

// restricts routes to logged in users only
const usersOnly = (req, res, next) => {
  if (!req.session.username) return next(err(401,'Client tried to access a users only route.'))
  next()
}

// restricts routes to recipient only
const recipientOnly = async (req, res, next) => {
  const id = req.params.id
  const { recipient } = await knex.select('recipient').from('requests').where({id}).first() || {}
  if ([recipient].includes(undefined)) return next(err(404,`Client tried to access a nonexistent route.`))
  if (recipient !== req.session.username) return next(err(403,'Client tried to access a recipient only route.'))
  next()
}

exports.usersOnly = usersOnly
exports.recipientOnly = recipientOnly
