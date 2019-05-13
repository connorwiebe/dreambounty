const $ = require('jquery')
const capsule = $('.capsule')
const clear = $('.capsule .clear')
const msgEl = $('.capsule .msg')
let t

const open = msg => {
  msgEl.text(msg)
  capsule.removeClass('close').addClass('open')
}

const close = () => {
  clearTimeout(t)
  capsule.removeClass('open').addClass('close')
}

const animate = async (msg,pin) => {
  console.log(pin)
  console.log('aniamte called')
  if (capsule.hasClass('open')) return
  console.log(clear)
  clear.removeClass('show').addClass('hide')
  if (pin) clear.removeClass('hide').addClass('show')
  open(msg,pin)
  if (pin) return
  t = setTimeout(() => {
    capsule.removeClass('open').addClass('close')
  },5000)
}

clear.on('click', e => close())
$(document).on('keyup', e => {
  const esc = 27
  if (e.keyCode === esc) clear.trigger('click')
})

exports.animate = animate
