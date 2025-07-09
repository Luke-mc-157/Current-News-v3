// Test script to verify X handle following feature
import { fetchUserFollowing } from './server/services/xApiFollowing.js';

async function testFollowingFeature() {
  console.log('Testing X handle following feature...');
  
  try {
    // Test with a more accessible public account
    const testHandle = 'twitter'; // Twitter's official account, should be accessible
    console.log(`Testing with @${testHandle}...`);
    
    const followingList = await fetchUserFollowing(testHandle);
    console.log(`✅ Successfully fetched following list for @${testHandle}`);
    console.log(`Found ${followingList.length} accounts that @${testHandle} follows`);
    
    if (followingList.length > 0) {
      console.log('Sample following accounts:');
      followingList.slice(0, 5).forEach((handle, index) => {
        console.log(`  ${index + 1}. @${handle}`);
      });
    }
    
    return true;
  } catch (error) {
    console.error('❌ Following feature test failed:', error.message);
    return false;
  }
}

// Run the test
testFollowingFeature().then(success => {
  if (success) {
    console.log('\n✅ X handle following feature is working correctly!');
  } else {
    console.log('\n❌ X handle following feature needs troubleshooting.');
  }
  process.exit(success ? 0 : 1);
});