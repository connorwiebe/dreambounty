const moment = require('moment')
module.exports = () => moment(new Date()).format('dddd, MMMM Do YYYY, h:mm:ss a')
