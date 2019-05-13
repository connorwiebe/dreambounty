const sgMail = require('@sendgrid/mail')
const dev = process.env.NODE_ENV === 'development'
sgMail.setApiKey(dev ? process.env.DEV_SENDGRID_API_KEY : process.env.SENDGRID_API_KEY)

module.exports = args => {

  args.message.push('<br><br>Dreambounty')

  const msg = {
    subject: args.subject,
    from: { name: 'Dreambounty', email: 'no-reply@dreambounty.com' },
    to: args.to && !dev ? args.to : process.env.MY_EMAIL,
    html: args.message.join('<br><br>')
  }

  return sgMail.send(msg)

}
