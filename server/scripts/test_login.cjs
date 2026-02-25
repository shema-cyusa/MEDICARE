(async function(){
  try {
    const res = await fetch('http://localhost:4000/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'mutesi@therapist.com', password: 'NewPass123!' })
    });
    const text = await res.text();
    console.log('STATUS', res.status);
    try {
      console.log('BODY', JSON.parse(text));
    } catch (e) {
      console.log('BODY', text);
    }
  } catch (err) {
    console.error('ERROR', err && err.stack ? err.stack : err);
  }
})();
