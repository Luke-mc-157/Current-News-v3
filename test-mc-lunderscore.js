// Test script to verify X handle following feature with @Mc_Lunderscore
import { fetchUserFollowing } from './server/services/xApiFollowing.js';

async function testMcLunderscore() {
  console.log('Testing X handle following feature with @Mc_Lunderscore...');
  
  try {
    const targetHandle = 'Mc_Lunderscore';
    console.log(`Fetching following list for @${targetHandle}...`);
    
    const followingList = await fetchUserFollowing(targetHandle);
    
    console.log('✅ Successfully fetched following list!');
    console.log(`@${targetHandle} follows ${followingList.length} accounts`);
    
    if (followingList.length > 0) {
      console.log('\nFirst 10 accounts they follow:');
      followingList.slice(0, 10).forEach((handle, index) => {
        console.log(`  ${index + 1}. @${handle}`);
      });
      
      if (followingList.length > 10) {
        console.log(`  ... and ${followingList.length - 10} more accounts`);
      }
    }
    
    return true;
  } catch (error) {
    console.error('❌ Following feature test failed:', error.message);
    return false;
  }
}

testMcLunderscore().then(success => {
  if (success) {
    console.log('\n✅ X handle following feature is working with @Mc_Lunderscore!');
  } else {
    console.log('\n❌ X handle following feature needs troubleshooting.');
  }
  process.exit(success ? 0 : 1);
});