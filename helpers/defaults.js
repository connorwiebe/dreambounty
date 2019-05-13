const $ = require('jquery')
const msg = require('./msg')
const dropdownMenu = $('.dropdown .menu')
const signOut = $('nav .item:last-child')

module.exports = () => {

  // navigation dropdown
  $('body').on('click', e => {
    const target = $(e.target)
    if (!target.parents('.menu').length) {
      if (target.parents('.dropdown').length && dropdownMenu.css('display') === 'none') {
        dropdownMenu.removeClass('hide').addClass('show')
      } else {
        dropdownMenu.removeClass('show').addClass('hide')
      }
    }
  })

  // sign out
  signOut.on('click', e => {
    $(e.currentTarget).submit()
  })

  // msg flash
  $(window).on('load', e => {
    const message = $('.msg').text()
    const pin = $('.capsule').attr('data-pin')
    if (message) msg.animate(message, pin)
  })

  // // GDPR confirm
  // $(`[data-name='login']`).on('submit', e => {
  //   if (!window.confirm('We share your username with Google Analytics. Do you consent to that?')) return e.preventDefault()
  // })

}
