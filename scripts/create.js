const $ = require('jquery')
require('../helpers/defaults')()
const csrf = $('input[name="csrf"]').attr('value')
const msg = require('../helpers/msg')
const fetch = require('../helpers/fetch')
const to = require('../helpers/to')
const storage = require('../helpers/storage')
const isAlphanumerical = require('is-alphanumerical')
const loaded = require('image-loaded')
const ga = require('../helpers/ga')()

// initialization
const recipientInput = $(`input[name='recipient']`)
$(() => {
  if ($(document).width() > 600) {
    recipientInput.focus()
  }
})
let noRecipient = recipientInput.val() === '' ? true : false
const titleInput = $('.request')
recipientInput.val($('.recipient .username').text())
titleInput.val(storage.get('title'))
titleInput.on('input', e => storage.set('title', $(e.target).val()))
const recipientUsername = $('.recipient .username').text()
const icon = $('.magnifier i')
if (recipientUsername) icon.addClass('show-clear').text('clear')
$(window).on('load', e => {
  if (recipientUsername) {
    noRecipient = false
    loaded(document.getElementsByClassName('avatar')[0], (err, alreadyLoaded) => {
      $('.recipient').addClass('height')
      setTimeout(() => $('.recipient, .stat-title').addClass('show'), 400)
    })
  }
})

// defer function
const defer = (timer => {
  return (callback, ms) => {
    clearTimeout(timer)
    timer = setTimeout(callback, ms)
  }
})()

// recipient
recipientInput.on('input', e => {
  let currentValue = e.target.value
  if (currentValue !== '') {
    icon.text('clear').addClass('show-clear')
  } else {
    icon.text('search').removeClass('show-clear')
  }
  const inputChars = e.target.value.split('')
  let input = inputChars.filter(char => isAlphanumerical(char) || char === '_' || char === ' ').join('')
  recipientInput.val(input)
  if (currentValue === input) {
    defer(async () => {
      const query = recipientInput.val()
      if (query !== '') {
        const [err,res] = await to(fetch({
          url: `/create/search?q=${query}`,
          method: 'get',
          creds: true
        }))
        if (err || !res.ok) {
          noRecipient = true
          return msg.animate(`There was an error while searching. We're looking into it!`)
        }
        const result = await res.json()
        if (result.noResults) {
          noRecipient = true
          return msg.animate('There are no results for that query.')
        }
        noRecipient = false
        // if showing close
        if ($('.recipient').hasClass('show')) await close()
        // add recipient info
        $('.recipient a').attr('href', `/users/${result.username}`)
        $('.recipient .avatar').attr('src', result.avatar)
        $('.recipient .name').text(result.name)
        $('.recipient .username').text(result.username)
        console.log(result)
        if (!result.verified) $('.recipient .badge').addClass('hide')
        if (result.verified) $('.recipient .badge').removeClass('hide')
        // after avatar loads show
        loaded(document.getElementsByClassName('avatar')[0], (err, alreadyLoaded) => {
          $('.recipient').addClass('height')
          setTimeout(() => $('.recipient, .stat-title').addClass('show'), 400)
        })
      }
    }, 1000)
  }
})

// submit
let submitted = false
$('.create-form').on('keypress', async e => {
  if (e.which === 13) return e.preventDefault()
})
$('.create-form').on('submit', async e => {
  if (submitted) return e.preventDefault()
  if (noRecipient || recipientInput.val() === '') {
    e.preventDefault()
    msg.animate('Choose a recipient for your request.')
  } else if (titleInput.val() === '') {
    e.preventDefault()
    msg.animate('Fill out what your request is.')
  } else {
    storage.set('newRequestCreated',true)
    submitted = true
  }
})

// clear
icon.on('click', async e => {
  if ($(e.target).text() === 'clear') {
    recipientInput.val('')
    noRecipient = true
    icon.text('search').removeClass('show-clear')
    await close()
    recipientInput.focus()
    const [err,res] = await to(fetch({
      url: '/create/delete',
      method: 'delete',
      body: {},
      csrf
    }))
    if (err || !res.ok) return msg.animate(`There was an error. We're looking into it!`)
  } else {
    const val = recipientInput.val()
    recipientInput.focus().val('').val(val)
  }
})

// close
async function close () {
  return new Promise ((resolve, reject) => {
    $('.recipient, .stat-title').removeClass('show')
    $('.recipient').removeClass('height')
    setTimeout(() => {
      return resolve()
    }, 400)
  })
}
