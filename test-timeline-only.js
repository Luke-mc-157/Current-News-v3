// Test Timeline Only - Direct test of the reverse chronological timeline endpoint
import { TwitterApi } from 'twitter-api-v2';

async function testTimelineOnly() {
  console.log('🔍 Testing Reverse Chronological Timeline Endpoint...\n');
  
  try {
    // Test with the access token you provided
    const accessToken = 'OFI4bVVMYy1wc2sycmZvQW11LTA5THRfVVhUVzUwaGV5MXpwZXdUY3BKWlNFOjE3NTIzNjM1NzY4Mzc6MToxOmF0OjE';
    const userId = '1222191403427680259'; // Your X user ID
    
    console.log('Using access token:', accessToken.substring(0, 30) + '...');
    console.log('User ID:', userId);
    console.log('Handle: Mc_Lunderscore\n');
    
    // Create authenticated client
    const client = new TwitterApi(accessToken);
    
    // First, verify the token works by getting user info
    try {
      const me = await client.v2.me();
      console.log('✅ Token verified. User:', me.data.username, '(', me.data.id, ')');
    } catch (error) {
      console.error('❌ Token verification failed:', error.message);
      return;
    }
    
    // Now test the reverse chronological timeline endpoint
    console.log('\nFetching reverse chronological timeline...');
    
    const startTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    console.log('Start time (24h ago):', startTime);
    
    try {
      // Direct API call to the reverse chronological endpoint
      const response = await client.v2.get(`users/${userId}/timelines/reverse_chronological`, {
        max_results: 10, // Start small
        'tweet.fields': 'id,text,created_at,author_id,public_metrics',
        expansions: 'author_id',
        'user.fields': 'username,name',
        start_time: startTime
      });
      
      console.log('\n✅ SUCCESS! Timeline response received');
      console.log('Posts found:', response.data?.length || 0);
      
      if (response.data && response.data.length > 0) {
        console.log('\nFirst post:');
        const firstPost = response.data[0];
        const author = response.includes?.users?.find(u => u.id === firstPost.author_id);
        console.log('- Author:', author?.username || 'unknown');
        console.log('- Text:', firstPost.text.substring(0, 100) + '...');
        console.log('- Likes:', firstPost.public_metrics?.like_count || 0);
        console.log('- Created:', firstPost.created_at);
      }
      
      console.log('\n🎉 Timeline endpoint working successfully!');
      
    } catch (timelineError) {
      console.error('\n❌ Timeline endpoint failed:');
      console.error('Error code:', timelineError.code);
      console.error('Error message:', timelineError.message);
      console.error('Error data:', JSON.stringify(timelineError.data, null, 2));
      
      if (timelineError.code === 403 && timelineError.data?.reason === 'client-not-enrolled') {
        console.log('\n⚠️  This endpoint requires your app to be attached to a Project');
        console.log('Visit: https://developer.twitter.com/en/docs/projects/overview');
      }
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  }
}

testTimelineOnly().catch(console.error);