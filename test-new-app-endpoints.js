// Test New App Endpoints - Test the implementation after token refresh fixes
console.log('🔍 Testing Updated X Authentication with Token Refresh...\n');

async function testEndpoint(url, method = 'POST') {
  try {
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' }
    });
    
    const data = await response.json();
    return { success: response.ok, data, status: response.status };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log('1. Checking OAuth configuration...');
  const status = await testEndpoint('http://localhost:5000/api/auth/x/status', 'GET');
  console.log('OAuth configured:', status.data?.configured);
  console.log('Callback URL:', status.data?.callbackUrl);
  
  console.log('\n2. Checking authentication status...');
  const auth = await testEndpoint('http://localhost:5000/api/auth/x/check', 'GET');
  console.log('Authenticated:', auth.data?.authenticated);
  console.log('X Handle:', auth.data?.xHandle || 'Not authenticated');
  
  if (!auth.data?.authenticated) {
    console.log('\n⚠️  Authentication required. Please:');
    console.log('1. Click "Login with X" button in the app');
    console.log('2. Complete OAuth authorization');
    console.log('3. Verify callback URL in X Developer Portal matches:');
    console.log('   ' + status.data?.callbackUrl);
    console.log('\n🔧 If OAuth fails with 401 error:');
    console.log('- Check callback URL is exactly right in X app settings');
    console.log('- Ensure Client Secret is configured correctly');
    console.log('- Try regenerating OAuth credentials in X Developer Portal');
    return;
  }
  
  console.log('\n3. Testing data fetch with token refresh...');
  const fetch = await testEndpoint('http://localhost:5000/api/x/fetch-user-data');
  
  if (fetch.success) {
    console.log('✅ Data fetch successful!');
    console.log('Timeline working:', fetch.data?.status?.timelineWorking);
    console.log('Posts found:', fetch.data?.timelineData?.totalPosts || 0);
    
    if (fetch.data?.timelineData?.samplePost) {
      console.log('\nSample post:');
      console.log('- Author:', fetch.data.timelineData.samplePost.author);
      console.log('- Text:', fetch.data.timelineData.samplePost.text);
      console.log('- Likes:', fetch.data.timelineData.samplePost.likes);
    }
    
    console.log('\n🎉 Success! Timeline endpoint working with token refresh capability');
  } else {
    console.log('❌ Data fetch failed:', fetch.data?.error || 'Unknown error');
    console.log('Status:', fetch.status);
    
    if (fetch.status === 401) {
      console.log('\n🔄 Token may have expired. The refresh logic should handle this automatically.');
    }
  }
}

runTests().catch(console.error);