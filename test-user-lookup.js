// Test script to check user lookup response format
import axios from "axios";

async function testUserLookup() {
  console.log('Testing X user lookup response format...');
  
  const bearerToken = process.env.X_BEARER_TOKEN;
  if (!bearerToken) {
    console.error('❌ X_BEARER_TOKEN not found');
    return false;
  }

  try {
    // Test with a different well-known account
    const testHandle = 'jack'; // Jack Dorsey, should be publicly accessible
    const url = `https://api.twitter.com/2/users/by/username/${testHandle}`;
    
    console.log(`Testing user lookup for @${testHandle}...`);
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${bearerToken}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ User lookup successful!');
    console.log('Full response:', JSON.stringify(response.data, null, 2));
    
    if (response.data && response.data.data) {
      console.log('User ID:', response.data.data.id);
      console.log('Username:', response.data.data.username);
      return response.data.data;
    } else {
      console.log('❌ Unexpected response format');
      return false;
    }
  } catch (error) {
    console.error('❌ User lookup failed:', error.response?.data || error.message);
    return false;
  }
}

testUserLookup();