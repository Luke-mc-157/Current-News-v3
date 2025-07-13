// Test Timeline Direct - Debug the exact OAuth issue
console.log('🔧 Direct OAuth Token Exchange Debug...\n');

// Import needed modules
import { TwitterApi } from 'twitter-api-v2';

async function testTimelineDirect() {
  try {
    // Check environment variables
    console.log('1. Checking environment variables...');
    const clientId = process.env.X_CLIENT_ID;
    const clientSecret = process.env.X_CLIENT_SECRET;
    
    console.log('Client ID present:', !!clientId);
    console.log('Client Secret present:', !!clientSecret);
    console.log('Client ID length:', clientId?.length);
    console.log('Client Secret length:', clientSecret?.length);
    
    if (!clientId || !clientSecret) {
      console.log('❌ Missing OAuth credentials');
      return;
    }
    
    // Test client creation
    console.log('\n2. Testing TwitterApi client creation...');
    const client = new TwitterApi({ 
      clientId,
      clientSecret 
    });
    
    console.log('✅ Client created successfully');
    
    // Test manual token exchange (simulating what happens in callback)
    console.log('\n3. Manual token exchange would require:');
    console.log('- Authorization code from X');
    console.log('- Code verifier from PKCE flow');
    console.log('- Exact redirect URI match');
    
    console.log('\n🔍 Known Issues to Check:');
    console.log('1. Callback URL must EXACTLY match in X Developer Portal');
    console.log('2. Client Secret must be the latest regenerated version');
    console.log('3. PKCE code verifier must match code challenge');
    console.log('4. Authorization code must be used immediately (expires quickly)');
    
    console.log('\n📋 Next Steps:');
    console.log('1. Verify callback URL in X Developer Portal');
    console.log('2. Try OAuth flow with new credentials');
    console.log('3. Check console logs during token exchange');
    
  } catch (error) {
    console.error('❌ Direct test failed:', error.message);
  }
}

testTimelineDirect().catch(console.error);