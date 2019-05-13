const $ = require('jquery')
require('../helpers/defaults')()
const msg = require('../helpers/msg')
const fetch = require('../helpers/fetch')
const to = require('../helpers/to')
const ga = require('../helpers/ga')()

// init
const firstTab = $('.tab:first-of-type')
const requests = $('.requests')
firstTab.addClass('active')
if (!$('.request').length) {
  const type = firstTab.text()
  emptyTab(type)
}

// get type
$('.tab').on('click', async e => {
  const target = $(e.target)
  const type = target.text()
  $('.active').removeClass('active')
  target.addClass('active')
  requests.empty()
  let stillLoading = true

  setTimeout(() => {
    if (stillLoading) {
      requests.append($(`<div class='loading'></div>`))
    } else {
      $('.loading').remove()
    }
  },300)

  const [err,res] = await to(fetch({
    url: `${location.pathname}/tab?type=${type}`,
    method: 'get',
    creds: true
  }))
  if (err || !res.ok) return msg.animate(`There was an error. We're working on it!`)
  const response = await res.text()

  stillLoading = false
  $('.loading').remove()
  setTimeout(() => {
    requests.append(response)
    if (!response) emptyTab(type)
  },10)

})

function emptyTab (type) {
  if (type === 'recipient') return requests.append($(`<div class='empty'>This user doesn't have any requests.</div>`))
  if (type === 'backed') return requests.append($(`<div class='empty'>This user hasn't backed any requests.</div>`))
  if (type === 'created') return requests.append($(`<div class='empty'>This user hasn't created any requests.</div>`))
}
