import { TwitterApi } from 'twitter-api-v2';
import crypto from 'crypto';

// Your X app's Client ID from developer portal
const clientId = process.env.X_CLIENT_ID; // Store in Replit env vars for security
const callbackUrl = process.env.REPL_SLUG && process.env.REPL_OWNER
  ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co/auth/twitter/callback`
  : 'http://127.0.0.1:5000/auth/twitter/callback'; // Use 127.0.0.1 instead of localhost

// In-memory session store for demo (use Redis/DB in production)
const sessions = new Map();

// PKCE code verifier generation (must be 43-128 characters)
function generateCodeVerifier() {
  return crypto.randomBytes(32).toString('base64url');
}

// Generate code challenge from verifier using SHA-256
function generateCodeChallenge(verifier) {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

// Step 1: Generate login URL for user
export function getXLoginUrl(state) {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  
  // Store code verifier for this session
  sessions.set(state, { codeVerifier, timestamp: Date.now() });
  
  const client = new TwitterApi({ clientId });
  return client.generateOAuth2AuthLink(callbackUrl, {
    scope: ['tweet.read', 'users.read'], // Removed offline.access as it may not be approved
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 's256', // Use SHA-256 for security
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
  console.log('X Auth Status:', {
    clientId: clientId ? 'Present' : 'Missing',
    callbackUrl,
    replSlug: process.env.REPL_SLUG,
    replOwner: process.env.REPL_OWNER
  });
  
  return {
    configured: isXAuthConfigured(),
    clientIdPresent: Boolean(clientId),
    callbackUrl
  };
}