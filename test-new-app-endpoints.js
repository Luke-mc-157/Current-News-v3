// Direct API Test for New App - Test endpoints individually
console.log('🔍 Testing New X App "Current News Application v3"...\n');

async function testEndpoint(url, method = 'POST') {
  try {
    const response = await fetch(`http://localhost:5000${url}`, {
      method,
      headers: { 'Content-Type': 'application/json' }
    });
    
    const data = await response.json();
    return { success: response.ok, status: response.status, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log('1. Testing X Auth Status...');
  const authStatus = await testEndpoint('/api/auth/x/status', 'GET');
  console.log('   Status:', authStatus.success ? '✅' : '❌');
  if (authStatus.data) {
    console.log('   Client ID:', authStatus.data.clientId);
    console.log('   Configured:', authStatus.data.configured);
  }

  console.log('\n2. Testing Project Attachment (targeted test)...');
  const projectTest = await testEndpoint('/api/x/test-project-attachment');
  console.log('   Status:', projectTest.success ? '✅' : '❌');
  if (projectTest.data) {
    console.log('   Overall Success:', projectTest.data.success);
    console.log('   User:', projectTest.data.xUser?.username);
    console.log('   Following Endpoint:', projectTest.data.endpoints?.following?.success ? '✅' : '❌');
    console.log('   Timeline Endpoint:', projectTest.data.endpoints?.timeline?.success ? '✅' : '❌');
    
    if (projectTest.data.endpoints?.following?.needsProjectAttachment) {
      console.log('   Following Issue: Project attachment needed');
    }
    if (projectTest.data.endpoints?.timeline?.count !== undefined) {
      console.log('   Timeline Posts Found:', projectTest.data.endpoints.timeline.count);
    }
  }

  console.log('\n3. Summary:');
  const timelineWorks = projectTest.data?.endpoints?.timeline?.success;
  const followingWorks = projectTest.data?.endpoints?.following?.success;
  
  if (timelineWorks && followingWorks) {
    console.log('🎉 BOTH ENDPOINTS WORKING! Project attachment successful!');
    console.log('Next step: Run full data fetch');
  } else if (timelineWorks && !followingWorks) {
    console.log('⚡ PARTIAL SUCCESS: Timeline working, Following needs Project attachment');
    console.log('The new app is partially configured correctly');
  } else if (!timelineWorks && !followingWorks) {
    console.log('❌ Both endpoints need Project attachment');
  }
}

runTests().catch(console.error);