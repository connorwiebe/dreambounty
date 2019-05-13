module.exports = async args => {

  // get
  if (args.method === 'get') {
    try {
      const response = await window.fetch(args.url, { method: 'get', credentials: args.creds ? 'include' : 'omit', signal: args.signal })
      return response
    } catch (err) {
      throw err
    }
  }

  // post, put and delete
  try {
    const response = await window.fetch(args.url, {
      headers: new Headers({
        'csrf': args.csrf,
        'content-type': 'application/json'
      }),
      body: JSON.stringify(args.body),
      method: args.method,
      credentials: 'include'
    })
    return response
  } catch (err) {
    throw err
  }

}
