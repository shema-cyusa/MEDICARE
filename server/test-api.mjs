import axios from 'axios';

async function testLogin() {
  try {
    console.log('Testing API at http://localhost:4000/api/auth/login');
    const response = await axios.post('http://localhost:4000/api/auth/login', {
      email: 'mutesi@therapist.com',
      password: 'NewPass123!'
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
