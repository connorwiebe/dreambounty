const $ = require('jquery')
const GAnalytics = require('ganalytics')
const uncaught = require('uncaught')
uncaught.start()

// GA (defaults)
module.exports = () => {
  const body = $('body')
  const [ gaid, uid, event ] = [body.attr('data-gaid'), body.attr('data-uid'), body.attr('data-event') ]
  body.removeAttr('data-gaid data-uid data-event')
  const ga = new GAnalytics(gaid, { uid }, true)

  // page view
  $(window).on('load', e => ga.send('pageview'))

  // send any errors to ga
  uncaught.addListener(error => {
    ga.send('exception', { exd: error })
  })

  // server side google analytics events
  if (event) ga.send('event', JSON.parse(event))

  return ga
}


/* Events:

start.js helper:
  Account Event: Account Created ✔

settings.js script:
  Account Event: Account Deleted ✔

create.js route:
  Request Event: Request Created ✔

request.js script:
  Request Event: Contribution ✔
  Request Event: Share Clicked ✔

*/

// add request accepted, etc event tracking
