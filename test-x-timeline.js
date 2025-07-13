// Test script for X timeline integration
import { TwitterApi } from 'twitter-api-v2';

async function testTimelineFetch() {
  // This requires an authenticated user's access token
  // In production, this would come from the database after OAuth flow
  const accessToken = process.env.TEST_X_ACCESS_TOKEN;
  const userHandle = process.env.TEST_X_HANDLE || 'testuser';
  
  if (!accessToken) {
    console.error('❌ No X access token found. Please authenticate first via the web UI.');
    console.log('1. Run the app and click "Login with X" button');
    console.log('2. Complete the OAuth flow');
    console.log('3. Check the database for stored tokens');
    return;
  }
  
  try {
    console.log('🔍 Testing X timeline fetch...');
    const client = new TwitterApi(accessToken);
    
    // Get user info
    const { data: user } = await client.v2.userByUsername(userHandle);
    console.log(`✅ Found user: ${user.username} (ID: ${user.id})`);
    
    // Fetch timeline
    const options = {
      start_time: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      max_results: 10,
      'tweet.fields': ['public_metrics', 'created_at', 'text', 'author_id'],
      expansions: ['author_id'],
      'user.fields': ['username']
    };
    
    const timeline = await client.v2.userTimeline(user.id, options);
    
    if (timeline.data?.data) {
      console.log(`\n📱 Timeline posts (${timeline.data.data.length} found):`);
      timeline.data.data.forEach((post, i) => {
        console.log(`\n${i + 1}. Post ID: ${post.id}`);
        console.log(`   Text: ${post.text.substring(0, 100)}...`);
        console.log(`   Likes: ${post.public_metrics?.like_count || 0}`);
        console.log(`   Created: ${post.created_at}`);
      });
    } else {
      console.log('❌ No timeline posts found');
    }
    
  } catch (error) {
    console.error('❌ Error testing timeline:', error.message);
    if (error.code === 401) {
      console.log('🔐 Authentication error - token may be expired');
    }
  }
}

// Run the test
testTimelineFetch();