import axios from 'axios';

async function testLogin() {
  try {
    console.log('Testing API at http://127.0.0.1:4000/api/auth/login');
    const response = await axios.post('http://127.0.0.1:4000/api/auth/login', {
      email: 'mutesi@therapist.com',
      password: 'NewPass123!'
    }, {
      timeout: 5000
    });
    console.log('✓ Login successful!');
    console.log('Response:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    if (error.response) {
      console.error('✗ Error:', error.response.status, error.response.data);
    } else if (error.request) {
      console.error('✗ No response:', error.message);
    } else {
      console.error('✗ Error:', error.message);
    }
  }
}

testLogin();
