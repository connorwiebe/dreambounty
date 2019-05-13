const legal = require('express-promise-router')()

// get
legal.get('/', (req, res, next) => {
  res.render('legal', {
    title: 'Legal | Dreambounty',
    description: `Dreambounty's Terms of Use and Privacy Policy.`
  })
})

module.exports = legal
