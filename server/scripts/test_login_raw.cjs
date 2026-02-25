const http = require('http');

const data = JSON.stringify({ email: 'mutesi@therapist.com', password: 'NewPass123!' });

const options = {
  hostname: 'localhost',
  port: 4000,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

const req = http.request(options, (res) => {
  let body = '';
  res.setEncoding('utf8');
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log('STATUS', res.statusCode);
    try { console.log('BODY', JSON.parse(body)); }
    catch (e) { console.log('BODY', body); }
  });
});

req.on('error', (e) => {
  console.error('REQUEST ERROR', e && e.stack ? e.stack : e);
});

req.write(data);
req.end();
