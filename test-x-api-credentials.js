// Test X API Credentials - Check what's configured and working
console.log('🔍 Testing X API Credentials and Authentication...\n');

async function testXCredentials() {
  try {
    // 1. Check OAuth configuration
    console.log('1. Checking OAuth configuration...');
    const statusResponse = await fetch('http://localhost:5000/api/auth/x/status');
    const status = await statusResponse.json();
    
    console.log('✅ X OAuth configured:', status.configured);
    console.log('   Client ID present:', status.clientIdPresent);
    console.log('   Client Secret present:', status.clientSecretPresent);
    console.log('   Callback URL:', status.callbackUrl);
    
    // 2. Check authentication status
    console.log('\n2. Checking authentication status...');
    const authResponse = await fetch('http://localhost:5000/api/auth/x/check');
    const authStatus = await authResponse.json();
    
    console.log('   Authenticated:', authStatus.authenticated);
    console.log('   Access token present:', !!authStatus.accessToken);
    console.log('   X Handle:', authStatus.xHandle || 'Not authenticated');
    
    if (!authStatus.authenticated) {
      console.log('\n⚠️  You need to authenticate with X first!');
      console.log('\nTo authenticate:');
      console.log('1. Click "Login with X" button in the app');
      console.log('2. Authorize the app in X');
      console.log('3. You\'ll be redirected back and authenticated');
      console.log('\nMake sure your callback URL in X Developer Portal is:');
      console.log(status.callbackUrl);
      return;
    }
    
    // 3. Test the stored access token
    console.log('\n3. Testing stored access token...');
    const testResponse = await fetch('http://localhost:5000/api/x/test-credentials', {
      method: 'POST'
    });
    
    if (testResponse.ok) {
      const testData = await testResponse.json();
      console.log('✅ Access token is valid!');
      console.log('   User:', testData.username);
      console.log('   User ID:', testData.id);
    } else {
      console.log('❌ Access token is invalid or expired');
      console.log('   Please re-authenticate with X');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testXCredentials().catch(console.error);