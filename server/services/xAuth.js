import { TwitterApi } from 'twitter-api-v2';
import crypto from 'crypto';

// Your X app's Client ID and Secret from developer portal
const clientId = process.env.X_CLIENT_ID;
const clientSecret = process.env.X_CLIENT_SECRET;

// Determine the correct callback URL based on environment
function getCallbackUrl() {
  console.log('Environment variables:', {
    REPLIT_DOMAINS: process.env.REPLIT_DOMAINS,
    REPL_SLUG: process.env.REPL_SLUG,
    REPL_OWNER: process.env.REPL_OWNER
  });

  // Check for Replit domains first
  if (process.env.REPLIT_DOMAINS) {
    const domains = process.env.REPLIT_DOMAINS.split(',');
    const primaryDomain = domains[0]; // Use the first domain
    const url = `https://${primaryDomain}/auth/twitter/callback`;
    console.log('Using REPLIT_DOMAINS callback URL:', url);
    return url;
  }
  
  // Fallback to old format
  if (process.env.REPL_SLUG && process.env.REPL_OWNER) {
    const url = `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co/auth/twitter/callback`;
    console.log('Using REPL_SLUG callback URL:', url);
    return url;
  }
  
  // Local development fallback
  const url = 'http://127.0.0.1:5000/auth/twitter/callback';
  console.log('Using local development callback URL:', url);
  return url;
}

const callbackUrl = getCallbackUrl();

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
  
  console.log('PKCE Debug:', {
    state,
    codeVerifier,
    codeChallenge,
    codeVerifierLength: codeVerifier.length
  });
  
  // Store code verifier for this session
  sessions.set(state, { codeVerifier, timestamp: Date.now() });
  
  const client = new TwitterApi({ 
    clientId,
    clientSecret 
  });
  return client.generateOAuth2AuthLink(callbackUrl, {
    scope: ['users.read'], // Start with minimal scope for testing
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 's256', // Use SHA-256 for security
  });
}

// Step 2: Handle OAuth callback
export async function handleXCallback(code, state) {
  console.log('OAuth Callback Debug:', {
    code: code?.substring(0, 20) + '...',
    state,
    callbackUrl,
    sessionsCount: sessions.size
  });

  const sessionData = sessions.get(state);
  if (!sessionData) {
    console.log('Available sessions:', Array.from(sessions.keys()));
    throw new Error('Invalid or expired session state');
  }
  
  console.log('Session Data:', {
    codeVerifier: sessionData.codeVerifier?.substring(0, 20) + '...',
    timestamp: sessionData.timestamp,
    ageMinutes: (Date.now() - sessionData.timestamp) / 60000
  });
  
  // Clean up old sessions (basic cleanup)
  const now = Date.now();
  for (const [key, value] of sessions.entries()) {
    if (now - value.timestamp > 600000) { // 10 minutes
      sessions.delete(key);
    }
  }
  
  const client = new TwitterApi({ 
    clientId,
    clientSecret 
  });
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
  return Boolean(clientId && clientSecret);
}

// Get configuration status
export function getXAuthStatus() {
  return {
    configured: Boolean(clientId && clientSecret),
    clientIdPresent: Boolean(clientId),
    clientSecretPresent: Boolean(clientSecret),
    callbackUrl
  };
}