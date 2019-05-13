const $ = require('jquery')
require('../helpers/defaults')()
const ga = require('../helpers/ga')()

// setup
const html = $('html')
const backdrop = $('.backdrop')

// set data attributes
$('li').each((i,v) => {
  $(v).attr('data-faq',`#${i}`)
})

// if hash exists on init call modalViewOpen
if (location.hash) $(() => modalViewOpen())

// if backdrop is clicked call modalViewClose
backdrop.on('click', e => location.hash = '')

// if hash changes call modalViewOpen
$(window).on('hashchange', e => {
  const oldUrl = e.originalEvent.oldURL
  const hashToClose = oldUrl.slice(oldUrl.indexOf('#'))
  modalViewClose(hashToClose)
})

// modalViewOpen function
function modalViewOpen () {
  const hashElement = $(`li[data-faq='${location.hash}']`)
  hashElement.addClass('modal')
  backdrop.fadeIn(500)
  const scrollTop = (hashElement.offset().top - (document.documentElement.clientHeight / 2) + (hashElement.outerHeight() / 2) )
  html.animate({ scrollTop }, 500)
}

// modalViewClose function
function modalViewClose (hashToClose = location.hash) {
  $(`li[data-faq='${hashToClose}']`).removeClass('modal')
  backdrop.fadeOut(500)
}
