const $ = require('jquery')
require('../helpers/defaults')()
const csrf = $('input[name="csrf"]').attr('value')
const msg = require('../helpers/msg')
const fetch = require('../helpers/fetch')
const to = require('../helpers/to')
const ga = require('../helpers/ga')()
const n = require('nprogress')
n.configure({showSpinner: false})

// add card
$('.add-card').on('click', e => {
  const email = $('.card').attr('data-email')
  const handler = StripeCheckout.configure({
    key: 'pk_test_MwlXM6yqdtYSMWjhQpuYJhOS',
    image: 'images/db.png',
    description: 'Add your card to start contributing.',
    locale: 'auto',
    email,
    zipCode: true,
    billingAddress: true,
    token: async token => {
      n.start()
      const [err,res] = await to(fetch({
        method: 'post',
        url: '/settings/add_card',
        body: {token},
        csrf
      }))
      if (err || !res.ok) return msg.animate(`There was an error adding your card.`)
      n.done()
      location.reload()
    }
  })
  handler.open({panelLabel: 'Add Payment Method'})
  $(window).one('popstate', e => handler.close())
})

// delete card
$('.delete-card').on('click', async e => {
  const confirmed = confirm('Are you sure? All your contributions will be lost.')
  if (confirmed) {
    n.start()
    const [err,res] = await to(fetch({
      method: 'delete',
      url: '/settings/delete_card',
      body: {},
      csrf
    }))
    if (err || !res.ok) return msg.animate(`There was an error deleting your card.`)
    n.done()
    location.reload()
  }
})

// disconnect stripe
$('.disconnect-stripe').on('click', async e => {
  const confirmed = confirm(`Are you sure? You won't be able to accept requests.`)
  if (confirmed) {
    n.start()
    const [err,res] = await to(fetch({
      method: 'delete',
      url: '/settings/disconnect_stripe',
      body: {},
      csrf
    }))
    if (err || !res.ok) return msg.animate(`There was an error disconnecting your stripe account.`)
    n.done()
    location.reload()
  }
})

// delete account
$('.delete-account').on('click', async e => {
  const confirmed = confirm(`Are you sure? This can't be undone.`)
  if (confirmed) {
    n.start()
    const [err,res] = await to(fetch({
      method: 'delete',
      url: '/settings/delete_account',
      body: {},
      csrf
    }))
    if (err || !res.ok) return msg.animate(`There was an error deleting your account.`)
    // track account deleted event
    ga.send('event', {
      ec: 'Account Event',
      ea: 'Account Deleted'
    })
    n.done()
    location.replace('/')
  }
})
