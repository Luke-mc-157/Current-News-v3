// Test the corrected timeline method
import { createAuthenticatedClient } from './server/services/xAuth.js';

async function testTimelineFetch() {
  console.log('🔍 Testing corrected timeline method...');
  
  try {
    // Import storage to get auth token
    const { storage } = await import('./server/storage.ts');
    const authToken = await storage.getXAuthTokenByUserId(1);
    
    if (!authToken) {
      console.log('❌ No authenticated user found. Please login with X first.');
      return;
    }
    
    console.log('✅ Found authenticated user:', authToken.xHandle);
    
    // Test the corrected method
    const client = createAuthenticatedClient(authToken.accessToken);
    
    // Get user ID
    const { data: user } = await client.v2.me();
    console.log(`Testing timeline for: ${user.username} (${user.id})`);
    
    // Test homeTimeline method
    console.log('\n📱 Testing homeTimeline method...');
    try {
      const timeline = await client.v2.homeTimeline({
        max_results: 5, // Small test to avoid hitting rate limits
        'tweet.fields': 'id,text,created_at,author_id,public_metrics',
        expansions: 'author_id',
        'user.fields': 'username,name'
      });
      
      console.log('✅ homeTimeline method SUCCESS!');
      console.log('   Data type:', typeof timeline.data);
      console.log('   Data length:', timeline.data?.length || 0);
      console.log('   Users included:', timeline.includes?.users?.length || 0);
      
      if (timeline.data && timeline.data.length > 0) {
        console.log('   Sample tweet:', {
          id: timeline.data[0].id,
          text: timeline.data[0].text.substring(0, 50) + '...',
          author_id: timeline.data[0].author_id
        });
        
        // Test user mapping
        const usersMap = new Map((timeline.includes?.users || []).map(u => [u.id, u]));
        const sampleAuthor = usersMap.get(timeline.data[0].author_id);
        console.log('   Sample author:', sampleAuthor?.username || 'unknown');
      }
      
    } catch (error) {
      console.log('❌ homeTimeline method failed:');
      console.log('   Error type:', error.constructor.name);
      console.log('   Error message:', error.message);
      console.log('   Error code:', error.code);
      
      if (error.code === 429) {
        console.log('   Rate limit hit - method exists but hit quota');
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testTimelineFetch().catch(console.error);