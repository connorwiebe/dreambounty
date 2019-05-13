const $ = require('jquery')
const storage = require('../helpers/storage')
const msg = require('../helpers/msg')
require('../helpers/defaults')()
const textarea = $('textarea')
const ga = require('../helpers/ga')()

// recipient has completed acceptance
if ($('.final').length) {
  storage.del('acceptUpdate')
}

// only need this stuff if it's the last step
if (textarea.length) {

  // local storage for accept update
  const update = $('.update')
  update.val(storage.get('acceptUpdate'))
  update.on('input', e => storage.set('acceptUpdate', $(e.target).val()))

  // submit
  let submitted = false
  $('form').on('keypress', async e => {
    if (e.which === 13) {
      e.preventDefault()
      return false
    }
  })
  $('form').on('submit', async e => {
    if (submitted) e.preventDefault()
    if (update.val() === '') {
      e.preventDefault()
      msg.animate('You must create your first update before accepting the request.')
    } else {
      submitted = true
    }
  })
}

// listen for email verified and reload the page
$(window).on('storage', e => {
  if (e.originalEvent.key === 'verified') {
    localStorage.removeItem('verified')
    location.reload()
  }
})
