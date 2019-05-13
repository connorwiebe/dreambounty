const $ = require('jquery')
require('../helpers/defaults')()
const msg = require('../helpers/msg')
const csrf = $('input[name="csrf"]').attr('value')
const isNumber = require('is-number')
const anime = require('animejs')
const fetch = require('../helpers/fetch')
const to = require('../helpers/to')
const storage = require('../helpers/storage')
const ga = require('../helpers/ga')()

// init
const id = location.pathname.slice(-3)
if (storage.get('newRequestCreated')) ['newRequestCreated','title'].forEach(item => storage.del(item))

// total animation function
const total = $('.total .stat-num')
const animateTotal = duration => {
  if (anime.running.length) anime.remove(total[0])
  anime({
    targets: total[0],
    round: 1,
    duration,
    'data-value': total.attr('data-total'),
    easing: 'easeOutExpo',
    update: animation => total.text(`$${total.attr('data-value')}`)
  })
}

// defer function
const defer = (timer => {
  return (callback, ms) => {
    clearTimeout(timer)
    timer = setTimeout(callback, ms)
  }
})()

// symbol click
const pay = $('.pay')
const symbol = $('.symbol')
symbol.on('click', e => {
  // cursor hack
  const val = pay.val()
  pay.focus().val('').val(val)
})

// contribute
pay.on('input keypress', e => {
  if (e.which === 13) return e.preventDefault()

  // only allow numbers
  const inputChars = e.target.value.split('')
  if (!inputChars.length) {
    pay.val('0')
  } else {
    let contribution = inputChars.filter(isNumber).join('')
    if (!+contribution[0] && contribution.length > 1) contribution = contribution.slice(1)
    pay.val(contribution)
  }

  // check if user can contribute
  if (pay.attr('data-is-registered') === 'false') {
    pay.val('0').blur()
    return msg.animate('You have to sign in to contribute.') // you have to change everywhere you see msg to msg.aniamte
  }

  // post contribution
  defer(async () => {
    const [err,res] = await to(fetch({
      url: `/${id}/contribute`,
      method: 'post',
      body: { contribution: pay.val() },
      csrf
    }))
    if (err || !res.ok) return msg.animate(`There was an error adding your contribution. We're looking into it!`)
    // update total and backers
    const result = await res.json()
    if (result.err) {
      pay.val('0').blur()
      return msg.animate(result.err)
    }
    const {raised,backers} = result.totals
    $('.owner .contribution').text(`$${pay.val()}`)
    $('.backers-count .stat-num').text(backers)
    total.attr('data-total', raised)
    animateTotal(2000)
    // track contributions
    ga.send('event', {
      ec: 'Request Event',
      ea: 'Contribution',
      el: `$${pay.val()}: ${$('.title').text()}`
    })
  },500)
})

// create update init
const createText = $('.create-text')
const createBtn = $('.create-btn')
const createCancel = $('.create-cancel')
if (storage.get('update')) {
  createText.val(storage.get('update'))
  createCancel.show()
}
createText.on('input', e => {
  if (!createText.val()) {
    createCancel.hide()
  } else if (createCancel.css('display') === 'none') {
    createCancel.show()
  }
  storage.set('update', $(e.target).val())
})

// cancel update click
$('.create-cancel').on('click', e => {
  createCancel.hide()
  createText.val('').blur()
  storage.set('update','')
})

// delete update
$('.delete-update').on('click', async e => {
  const confirmed = confirm('Are you sure you want to delete this update?')
  if (confirmed) {
    const updateId = $(e.target).parents('.update').attr('data-id')
    const [err,res] = await to(fetch({
      url: `/${id}/delete_update`,
      method: 'delete',
      body: { updateId },
      csrf
    }))
    if (err || !res.ok) return msg.animate('There was an error deleting your update.')
    location.reload()
  }
})

// create update
let canClick = true
createBtn.on('click', async e => {
  const update = createText.val()
  if (canClick && update) {
    canClick = false
    const [err,res] = await to(fetch({
      url: `/${id}/update`,
      method: 'post',
      body: { update },
      csrf
    }))
    if (err || !res.ok) {
      canClick = true
      return msg.animate('There was an error creating your update.')
    }
    const result = await res.json()
    if (result.err) return msg.animate(result.err)
    storage.set('update','')
    location.reload()
  }
})

// delete request
$('.delete-request').on('click', async e => {
  const confirmed = confirm('Are you sure you want to delete this request?')
  if (confirmed) {
    const [err,res] = await to(fetch({
      url: `/${id}/delete`,
      method: 'delete',
      body: {},
      csrf
    }))
    if (err || !res.ok) return msg.animate(`There was an error deleting your request.`)
    location.replace('/')
  }
})
