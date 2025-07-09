// Test script to verify system works without following list feature
import { compileVerifiedSources } from './server/services/dynamicSources.js';

async function testSystemWithoutFollowing() {
  console.log('Testing system functionality without following list access...');
  
  try {
    // Test that the system still works even when following list fails
    const topics = ['technology'];
    const testHandle = 'Mc_Lunderscore';
    
    console.log(`Testing compileVerifiedSources with topics: ${topics.join(', ')} and X handle: @${testHandle}`);
    console.log('(This should gracefully handle the following list limitation)');
    
    const sources = await compileVerifiedSources(topics, 'default', testHandle);
    
    console.log('✅ System test successful!');
    console.log('Sources compiled:');
    sources.forEach((topicSource, index) => {
      console.log(`  Topic ${index + 1}: ${topicSource.topic}`);
      console.log(`    User-defined sources: ${topicSource.user_sources ? topicSource.user_sources.length : 0}`);
      console.log(`    Suggested sources: ${topicSource.suggested_sources ? topicSource.suggested_sources.length : 0}`);
    });
    
    return true;
  } catch (error) {
    console.error('❌ System test failed:', error.message);
    return false;
  }
}

testSystemWithoutFollowing().then(success => {
  if (success) {
    console.log('\n✅ System works correctly even without following list access!');
  } else {
    console.log('\n❌ System needs troubleshooting.');
  }
  process.exit(success ? 0 : 1);
});