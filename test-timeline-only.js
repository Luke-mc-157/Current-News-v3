// Test Timeline Endpoint Only - Focused test for working endpoint
import { TwitterApi } from 'twitter-api-v2';

async function testTimelineOnly() {
  console.log('🔍 Testing Timeline Endpoint Only...\n');
  
  try {
    // Create OAuth client with new credentials
    const client = new TwitterApi({
      clientId: process.env.X_CLIENT_ID,
      clientSecret: process.env.X_CLIENT_SECRET
    });
    
    console.log('New Client ID:', process.env.X_CLIENT_ID);
    
    // For now, we need an actual access token from successful OAuth
    // Let's check if user is authenticated in our database
    console.log('Checking database for authenticated user...');
    
    // Import our database functions
    const { storage } = await import('./server/storage.ts');
    const authToken = await storage.getXAuthTokenByUserId(1);
    
    if (!authToken) {
      console.log('❌ No authenticated user found. Please login with X first.');
      console.log('Visit the web app and click "Login with X" button');
      return;
    }
    
    console.log('✅ Found authenticated user:', authToken.xHandle);
    
    // Test timeline endpoint with actual user token
    const authenticatedClient = new TwitterApi(authToken.accessToken);
    
    // Get user info first
    const { data: user } = await authenticatedClient.v2.me();
    console.log(`Testing timeline for: ${user.username} (${user.id})`);
    
    // Test timeline endpoint
    console.log('\n📱 Testing timeline endpoint...');
    try {
      const timeline = await authenticatedClient.v2.userTimeline(user.id, {
        max_results: 10,
        'tweet.fields': 'id,text,created_at,author_id,public_metrics'
      });
      
      console.log('✅ Timeline endpoint response:');
      console.log('   Data type:', typeof timeline.data);
      console.log('   Data length:', timeline.data?.length || 0);
      console.log('   Meta:', timeline.meta);
      
      if (timeline.data && timeline.data.length > 0) {
        console.log('   Sample tweet:', {
          id: timeline.data[0].id,
          text: timeline.data[0].text.substring(0, 100) + '...',
          created_at: timeline.data[0].created_at
        });
      }
      
    } catch (error) {
      console.log('❌ Timeline endpoint failed:');
      console.log('   Code:', error.code);
      console.log('   Reason:', error.data?.reason);
      console.log('   Detail:', error.data?.detail);
    }
    
    // Test follows endpoint for comparison
    console.log('\n👥 Testing follows endpoint...');
    try {
      const following = await authenticatedClient.v2.following(user.id, {
        max_results: 5,
        'user.fields': 'id,username,name,verified'
      });
      
      console.log('✅ Follows endpoint response:');
      console.log('   Data length:', following.data?.length || 0);
      
    } catch (error) {
      console.log('❌ Follows endpoint failed:');
      console.log('   Code:', error.code);
      console.log('   Reason:', error.data?.reason);
      console.log('   Client ID in error:', error.data?.client_id);
      
      if (error.data?.reason === 'client-not-enrolled') {
        console.log('   🎯 CONFIRMED: Follows endpoint needs Project attachment');
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
  
  console.log('\n📋 ANALYSIS:');
  console.log('If timeline works but follows fails, it means:');
  console.log('1. Your new app credentials are partially working');
  console.log('2. Project attachment may be incomplete or endpoint-specific');
  console.log('3. Some endpoints may have different permission requirements');
}

testTimelineOnly().catch(console.error);