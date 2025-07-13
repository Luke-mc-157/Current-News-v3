// Debug Callback URL - Show exact URL that needs to be in X Developer Portal
console.log('🔧 Callback URL Debug for X Developer Portal...\n');

async function debugCallbackUrl() {
  try {
    const response = await fetch('http://localhost:5000/api/auth/x/status');
    const status = await response.json();
    
    console.log('📋 X Developer Portal Settings Required:');
    console.log('==================================================');
    console.log('');
    console.log('Go to: https://developer.x.com/en/portal/dashboard');
    console.log('Find your app: "Current News Application v3"');
    console.log('');
    console.log('**CALLBACK URL (must match EXACTLY):**');
    console.log('');
    console.log(status.callbackUrl);
    console.log('');
    console.log('==================================================');
    console.log('');
    console.log('Steps to fix:');
    console.log('1. Copy the URL above EXACTLY');
    console.log('2. Paste it in your X app settings');
    console.log('3. Save the changes');
    console.log('4. Try authentication again');
    console.log('');
    console.log('Common mistakes:');
    console.log('- Adding extra slashes');
    console.log('- Using http instead of https');
    console.log('- Wrong subdomain (replit URLs change)');
    console.log('- Copy/paste formatting issues');
    
  } catch (error) {
    console.error('❌ Failed to get callback URL:', error.message);
  }
}

debugCallbackUrl().catch(console.error);