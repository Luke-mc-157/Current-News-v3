// Test script to verify Bearer Token works for user lookups
import axios from "axios";

async function testBearerToken() {
  console.log('Testing X Bearer Token authentication...');
  
  const bearerToken = process.env.X_BEARER_TOKEN;
  if (!bearerToken) {
    console.error('❌ X_BEARER_TOKEN not found');
    return false;
  }

  try {
    // Test with a simple user lookup
    const testHandle = 'twitter';
    const url = `https://api.twitter.com/2/users/by/username/${testHandle}`;
    
    console.log(`Testing user lookup for @${testHandle}...`);
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${bearerToken}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Bearer Token authentication successful!');
    console.log('User data:', response.data.data);
    return true;
  } catch (error) {
    console.error('❌ Bearer Token authentication failed:', error.response?.data || error.message);
    return false;
  }
}

testBearerToken().then(success => {
  if (success) {
    console.log('\n✅ Bearer Token is working correctly!');
  } else {
    console.log('\n❌ Bearer Token needs to be checked.');
  }
  process.exit(success ? 0 : 1);
});