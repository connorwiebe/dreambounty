const $ = require('jquery')
require('../helpers/defaults')()
const lozad = require('lozad')
const msg = require('../helpers/msg')
const fetch = require('../helpers/fetch')
const to = require('../helpers/to')
const ga = require('../helpers/ga')()

//init
const searchInput = $(`input[name='search']`)
$(() => {
  if ($(document).width() > 600) {
    searchInput.focus()
  }
})

// defer function
const defer = (timer => {
  return (callback, ms) => {
    clearTimeout(timer)
    timer = setTimeout(callback, ms)
  }
})()

// search
let controller
let signal

const requests = $('.requests')
const initRequests = $('.init-request')
const icon = $('.magnifier i')
searchInput.on('input', async e => {
  const q = e.target.value
  if (q !== '') {
    icon.text('clear').addClass('show-clear')
    defer(async () => {
      // cancel the previous request
      if (controller) controller.abort()
      // feature detection
      if ('AbortController' in window) {
        controller = new AbortController()
        signal = controller.signal
      }
      return await search(q, signal)
    }, 1) // was 300, increase if needed
  } else {
    icon.text('search').removeClass('show-clear')
    requests.children().remove('.search-request')
    initRequests.show()
  }
})

// search function
async function search (q, signal) {
  const [err,res] = await to(fetch({
    url: `/search?q=${q}`,
    method: 'get',
    creds: true,
    signal
  }))
  if (err || !res.ok) {
    if (err && err.name === 'AbortError') return
    return msg.animate(`There was an error searching requests. We're working on it!`)
  }
  if (searchInput.val() !== '') {
    const body = await res.text()
    initRequests.hide()
    requests.children().remove('.search-request')
    requests.append(body)
  }
}

// clear search field
icon.on('click', e => {
  if ($(e.target).text() === 'clear') {
    searchInput.val('')
    icon.text('search').removeClass('show-clear')
    requests.children().remove('.search-request')
    initRequests.show()
  } else {
    searchInput.focus()
  }
})

// lazy load avatars
const observer = lozad('.lazy')
observer.observe()

// sort
const type = $('.type')
const top = $('.type:last-of-type')
top.addClass('active')

type.on('click', e => {
  const target = $(e.target)
  type.removeClass('active')
  target.addClass('active')
})
