const ga = require('../helpers/ga')()

// verify functionality
if (document.getElementById('msg').textContent === 'Email Verified') {
  const id = location.pathname.slice(-3)
  setTimeout(() => {
    localStorage.setItem('verified',true)
    location.replace(`/accept/${id}`)
  }, 2000)
}
