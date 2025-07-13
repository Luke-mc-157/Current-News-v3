// Test the fixed OAuth implementation
import { getXLoginUrl, isXAuthConfigured } from './server/services/xAuth.js';

console.log('🔐 Testing fixed X OAuth implementation...\n');

// Check configuration
console.log('1. Configuration Status:');
console.log('   Configured:', isXAuthConfigured());

// Test URL generation  
console.log('\n2. Testing URL Generation:');
try {
  const testState = 'test-state-' + Date.now();
  const authLink = getXLoginUrl(testState);
  
  console.log('   ✅ URL generated successfully');
  console.log('   Contains state:', authLink.url.includes(testState));
  console.log('   Contains scope:', authLink.url.includes('users.read'));
  console.log('   Contains PKCE:', authLink.url.includes('code_challenge'));
  console.log('   URL length:', authLink.url.length);
  
} catch (error) {
  console.log('   ❌ URL generation failed:', error.message);
}

console.log('\n3. Ready for authentication test in browser');
console.log('   Navigate to the app and click "Login with X" to test the fixed flow');