// Test script to verify the complete X following integration
import { fetchXPosts } from './server/services/xSearch.js';

async function testFollowingIntegration() {
  console.log('Testing complete X handle following integration...');
  
  try {
    // Test with topics and a username that should work
    const topics = ['technology', 'artificial intelligence'];
    const testHandle = 'twitter'; // Use Twitter's official account for testing
    
    console.log(`Testing fetchXPosts with topics: ${topics.join(', ')} and X handle: @${testHandle}`);
    
    const results = await fetchXPosts(topics, 'default', testHandle);
    
    console.log('✅ Integration test successful!');
    console.log('Results summary:');
    for (const topic of topics) {
      const posts = results[topic] || [];
      console.log(`  ${topic}: ${posts.length} posts found`);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Integration test failed:', error.message);
    return false;
  }
}

testFollowingIntegration().then(success => {
  if (success) {
    console.log('\n✅ X handle following integration is working!');
  } else {
    console.log('\n❌ X handle following integration needs troubleshooting.');
  }
  process.exit(success ? 0 : 1);
});