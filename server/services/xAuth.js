import { TwitterApi } from 'twitter-api-v2';

// Your X app's Client ID from developer portal
const clientId = process.env.X_CLIENT_ID; // Store in Replit env vars for security
const callbackUrl = process.env.NODE_ENV === 'production' 
  ? 'https://your-app-name.replit.app/auth/twitter/callback'
  : 'https://your-repl-name--your-username.repl.co/auth/twitter/callback';

// In-memory session store for demo (use Redis/DB in production)
const sessions = new Map();

// PKCE code verifier generation
function generateCodeVerifier() {
  return [...Array(128)].map(() => Math.random().toString(36)[2] || '0').join('');
}

// Step 1: Generate login URL for user
export function getXLoginUrl(state) {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = codeVerifier; // For simplicity; in production, hash it with SHA-256
  
  // Store code verifier for this session
  sessions.set(state, { codeVerifier, timestamp: Date.now() });
  
  const client = new TwitterApi({ clientId });
  return client.generateOAuth2AuthLink(callbackUrl, {
    scope: ['tweet.read', 'users.read', 'offline.access'],
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'plain', // Or 's256' if hashing
  });
}

// Step 2: Handle OAuth callback
export async function handleXCallback(code, state) {
  const sessionData = sessions.get(state);
  if (!sessionData) {
    throw new Error('Invalid or expired session state');
  }
  
  // Clean up old sessions (basic cleanup)
  const now = Date.now();
  for (const [key, value] of sessions.entries()) {
    if (now - value.timestamp > 600000) { // 10 minutes
      sessions.delete(key);
    }
  }
  
  const client = new TwitterApi({ clientId });
  try {
    const { accessToken, refreshToken, expiresIn } = await client.loginWithOAuth2({
      code,
      codeVerifier: sessionData.codeVerifier,
      redirectUri: callbackUrl,
    });
    
    // Clean up the session
    sessions.delete(state);
    
    return {
      accessToken,
      refreshToken,
      expiresIn,
      success: true
    };
  } catch (error) {
    console.error('X OAuth error:', error);
    sessions.delete(state);
    throw new Error('Authentication failed: ' + error.message);
  }
}

// Create authenticated client instance
export function createAuthenticatedClient(accessToken) {
  return new TwitterApi(accessToken);
}

// Verify if X API credentials are configured
export function isXAuthConfigured() {
  return Boolean(clientId);
}

// Get configuration status
export function getXAuthStatus() {
  return {
    configured: isXAuthConfigured(),
    clientIdPresent: Boolean(clientId),
    callbackUrl
  };
}