// Direct Timeline Test - Test just the working timeline endpoint
import { TwitterApi } from 'twitter-api-v2';

async function testTimelineDirect() {
  console.log('🔍 Testing Timeline Endpoint Directly...\n');
  
  try {
    // Use the new app credentials directly
    const client = new TwitterApi({
      clientId: process.env.X_CLIENT_ID,
      clientSecret: process.env.X_CLIENT_SECRET
    });
    
    console.log('✅ New Client ID:', process.env.X_CLIENT_ID);
    
    // We need a test access token. Since the user is already authenticated,
    // let's use our API to get the timeline data
    console.log('Calling our API endpoint...');
    
    const response = await fetch('http://localhost:5000/api/x/test-project-attachment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    const result = await response.json();
    console.log('API Response:', JSON.stringify(result, null, 2));
    
    if (result.endpoints?.timeline?.success) {
      console.log('\n🎉 TIMELINE ENDPOINT CONFIRMED WORKING!');
      console.log('Posts found:', result.endpoints.timeline.count);
    }
    
    if (result.endpoints?.following?.needsProjectAttachment) {
      console.log('\n⚠️  Following endpoint still needs Project attachment');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testTimelineDirect().catch(console.error);