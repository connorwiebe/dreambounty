const faq = require('express-promise-router')()

// get
faq.get('/', (req, res, next) => {
  res.render('faq', {
    title: 'Faq | Dreambounty',
    description: 'Frequently Asked Questions about Dreambounty.'
  })
})

module.exports = faq
