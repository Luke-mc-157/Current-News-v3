// Test script to verify X OAuth authentication
import crypto from "crypto";
import axios from "axios";

function generateAuthHeader(url, method, params = {}) {
  const accessToken = process.env.X_ACCESS_TOKEN;
  const accessTokenSecret = process.env.X_ACCESS_TOKEN_SECRET;
  const consumerKey = process.env.X_CONSUMER_KEY;
  const consumerSecret = process.env.X_CONSUMER_SECRET;

  if (!accessToken || !accessTokenSecret || !consumerKey || !consumerSecret) {
    throw new Error("Missing X API OAuth credentials");
  }

  console.log(`Using consumer key: ${consumerKey.substring(0, 10)}...`);
  console.log(`Using access token: ${accessToken.substring(0, 10)}...`);

  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomBytes(16).toString('hex');

  const oauthParams = {
    oauth_consumer_key: consumerKey,
    oauth_token: accessToken,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp,
    oauth_nonce: nonce,
    oauth_version: '1.0'
  };

  const allParams = { ...oauthParams, ...params };
  
  const paramString = Object.keys(allParams)
    .sort()
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(allParams[key])}`)
    .join('&');

  const signatureBaseString = `${method.toUpperCase()}&${encodeURIComponent(url)}&${encodeURIComponent(paramString)}`;
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(accessTokenSecret)}`;
  const signature = crypto.createHmac('sha1', signingKey).update(signatureBaseString).digest('base64');
  
  oauthParams.oauth_signature = signature;

  const authHeader = 'OAuth ' + Object.keys(oauthParams)
    .map(key => `${encodeURIComponent(key)}="${encodeURIComponent(oauthParams[key])}"`)
    .join(', ');

  return authHeader;
}

async function testOAuth() {
  console.log('Testing X OAuth authentication...');
  
  try {
    // Test with a simple API call to verify credentials
    const url = 'https://api.twitter.com/2/users/me';
    const authHeader = generateAuthHeader(url, 'GET');
    
    console.log('Making authenticated request to verify credentials...');
    const response = await axios.get(url, {
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ OAuth authentication successful!');
    console.log('Authenticated user:', response.data.data);
    return true;
  } catch (error) {
    console.error('❌ OAuth authentication failed:', error.response?.data || error.message);
    return false;
  }
}

testOAuth().then(success => {
  if (success) {
    console.log('\n✅ X OAuth credentials are working correctly!');
  } else {
    console.log('\n❌ X OAuth credentials need to be checked.');
  }
  process.exit(success ? 0 : 1);
});