module.exports = () => {
  if (process.env.NODE_ENV === 'development') {
    return {
      client: 'pg',
      pool: { min: 1, max: 100 },
      // debug: true,
      connection: { database : 'dreambounty' }
    }
  } else {
    return {
      client: 'pg',
      pool: { min: 1, max: 20 }, // heroku free tier limit
      connection: process.env.DATABASE_URL,
      ssl : true
    }
  }
}
