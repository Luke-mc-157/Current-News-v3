// Test available methods in twitter-api-v2 client
import { TwitterApi } from 'twitter-api-v2';

async function testAvailableMethods() {
  console.log('🔍 Testing available X API v2 methods...');
  
  try {
    // Create client with our credentials
    const client = new TwitterApi({
      clientId: process.env.X_CLIENT_ID,
      clientSecret: process.env.X_CLIENT_SECRET
    });
    
    console.log('\n📋 Available v2 methods:');
    const v2Methods = Object.getOwnPropertyNames(Object.getPrototypeOf(client.v2));
    console.log('v2 methods:', v2Methods.filter(m => !m.startsWith('_')).sort());
    
    // Look for timeline-related methods
    const timelineMethods = v2Methods.filter(m => m.toLowerCase().includes('timeline'));
    console.log('\n⏰ Timeline-related methods:', timelineMethods);
    
    // Look for user-related methods
    const userMethods = v2Methods.filter(m => m.toLowerCase().includes('user'));
    console.log('\n👤 User-related methods:', userMethods);
    
    // Check specific method names we might need
    const potentialMethods = [
      'reverseChronologicalTimeline',
      'userTimeline', 
      'homeTimeline',
      'timeline',
      'tweets',
      'userTweets'
    ];
    
    console.log('\n🎯 Checking potential method names:');
    potentialMethods.forEach(method => {
      const exists = typeof client.v2[method] === 'function';
      console.log(`  ${method}: ${exists ? '✅' : '❌'}`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testAvailableMethods().catch(console.error);