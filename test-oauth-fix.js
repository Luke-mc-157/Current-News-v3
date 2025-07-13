// Test OAuth Fix - Check if callback URL fix resolves the 401 error
console.log('🔍 Testing OAuth Callback URL Fix...\n');

async function testOAuthFix() {
  try {
    // 1. Check current configuration
    console.log('1. Checking current OAuth configuration...');
    const configResponse = await fetch('http://localhost:5000/api/auth/x/debug');
    const config = await configResponse.json();
    
    console.log('✅ Current callback URL:', config.currentUrls.callbackUrl);
    console.log('✅ Website URL:', config.currentUrls.websiteUrl);
    
    // 2. Test login URL generation
    console.log('\n2. Testing login URL generation...');
    const loginResponse = await fetch('http://localhost:5000/api/auth/x/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    const loginData = await loginResponse.json();
    
    if (loginData.loginUrl) {
      console.log('✅ Login URL generated successfully');
      console.log('   URL contains callback:', loginData.loginUrl.includes('redirect_uri'));
    } else {
      console.log('❌ Failed to generate login URL:', loginData.error);
    }
    
    // 3. Instructions for user
    console.log('\n📋 NEXT STEPS:');
    console.log('1. Copy this callback URL:');
    console.log('   ' + config.currentUrls.callbackUrl);
    console.log('\n2. Go to X Developer Portal:');
    console.log('   https://developer.x.com/en/portal/dashboard');
    console.log('\n3. Find your app "Current News Application v3"');
    console.log('\n4. Update Authentication Settings with EXACT URL above');
    console.log('\n5. Save changes and test login again');
    
    console.log('\n⚠️  IMPORTANT: The URL must match EXACTLY (case-sensitive, no trailing slash)');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testOAuthFix().catch(console.error);