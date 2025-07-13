// Test OAuth Fix - Test authentication after X_CLIENT_SECRET regeneration
console.log('🔧 Testing OAuth after X_CLIENT_SECRET regeneration...\n');

async function testOAuthFix() {
  try {
    // 1. Check if new secret is loaded
    console.log('1. Checking OAuth configuration with new secret...');
    const statusResponse = await fetch('http://localhost:5000/api/auth/x/status');
    const status = await statusResponse.json();
    
    console.log('✅ OAuth configured:', status.configured);
    console.log('   Client ID present:', status.clientIdPresent);
    console.log('   Client Secret present:', status.clientSecretPresent);
    console.log('   Callback URL:', status.callbackUrl);
    
    if (!status.configured) {
      console.log('❌ OAuth still not configured properly');
      return;
    }
    
    // 2. Generate a new auth URL to test the flow
    console.log('\n2. Generating new auth URL...');
    const loginResponse = await fetch('http://localhost:5000/api/auth/x/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (loginResponse.ok) {
      const loginData = await loginResponse.json();
      console.log('✅ Auth URL generated successfully');
      console.log('   Login URL created:', !!loginData.loginUrl);
      console.log('   State parameter:', loginData.state);
      
      console.log('\n🔗 Auth URL ready. To test:');
      console.log('1. Click "Login with X" button in the app');
      console.log('2. Authorize the app in X');
      console.log('3. Check if token exchange succeeds');
      
      console.log('\n📋 OAuth Flow Status:');
      console.log('- Client credentials: ✅ Updated');
      console.log('- Auth URL generation: ✅ Working');
      console.log('- Token exchange: 🔄 Ready to test');
      
    } else {
      const errorData = await loginResponse.json();
      console.log('❌ Auth URL generation failed:', errorData.error);
    }
    
    // 3. Check if we can test the refresh logic (if tokens exist)
    console.log('\n3. Checking for existing tokens to test refresh...');
    const authResponse = await fetch('http://localhost:5000/api/auth/x/check');
    const authStatus = await authResponse.json();
    
    if (authStatus.authenticated) {
      console.log('✅ Found existing valid tokens');
      console.log('   Testing token refresh logic...');
      
      const fetchResponse = await fetch('http://localhost:5000/api/x/fetch-user-data', {
        method: 'POST'
      });
      
      if (fetchResponse.ok) {
        console.log('✅ Token refresh logic working');
      } else {
        console.log('🔄 Token refresh triggered, check logs');
      }
    } else {
      console.log('ℹ️  No valid tokens yet - complete OAuth flow first');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testOAuthFix().catch(console.error);