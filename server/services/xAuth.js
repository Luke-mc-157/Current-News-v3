import { TwitterApi } from 'twitter-api-v2';
import crypto from 'crypto';

// Your X app's Client ID and Secret from developer portal
const clientId = process.env.X_CLIENT_ID;
const clientSecret = process.env.X_CLIENT_SECRET;

// Global variable to store the callback URL, will be set per request
let callbackUrl = null;

// Determine the correct callback URL based on request or environment
export function getCallbackUrl(req = null) {
  // If we have a request object, use the actual host from the request
  if (req) {
    const protocol = req.get('x-forwarded-proto') || req.protocol || 'https';
    const host = req.get('x-forwarded-host') || req.get('host');
    const requestCallbackUrl = `${protocol}://${host}/auth/twitter/callback`;
    
    console.log('🔍 getCallbackUrl() from request:');
    console.log('- Protocol:', protocol);
    console.log('- Host:', host);
    console.log('- Callback URL:', requestCallbackUrl);
    
    return requestCallbackUrl;
  }
  
  // Fallback to environment-based calculation for initialization
  console.log('🔍 getCallbackUrl() - Environment fallback:');
  console.log('- NODE_ENV:', process.env.NODE_ENV);
  console.log('- REPLIT_DOMAINS:', process.env.REPLIT_DOMAINS);
  console.log('- REPL_SLUG:', process.env.REPL_SLUG);
  console.log('- REPL_OWNER:', process.env.REPL_OWNER);
  
  // Check for Replit domains first
  if (process.env.REPLIT_DOMAINS) {
    const domains = process.env.REPLIT_DOMAINS.split(',');
    const primaryDomain = domains[0]; // Use the first domain
    const envCallbackUrl = `https://${primaryDomain}/auth/twitter/callback`;
    console.log('✅ Using REPLIT_DOMAINS callback:', envCallbackUrl);
    return envCallbackUrl;
  }
  
  // Fallback to old format for production deployment
  if (process.env.REPL_SLUG && process.env.REPL_OWNER) {
    // For production, check if we're current-news specifically
    const isCurrentNews = process.env.REPL_SLUG === 'current-news' || 
                         process.env.REPL_SLUG === 'workspace';
    const productionDomain = isCurrentNews ? 'current-news' : process.env.REPL_SLUG;
    const productionUrl = `https://${productionDomain}.replit.app/auth/twitter/callback`;
    console.log('⚠️ Using fallback production URL:', productionUrl);
    return productionUrl;
  }
  
  // Local development fallback
  const localUrl = 'http://127.0.0.1:5000/auth/twitter/callback';
  console.log('⚠️ Using local development fallback:', localUrl);
  return localUrl;
}

// Initialize with environment-based URL for status checks
callbackUrl = getCallbackUrl();

// In-memory session store for demo (use Redis/DB in production)
const sessions = new Map();

// Base64URL encoding function (RFC 7636 compliant)
function base64URLEncode(str) {
  return str.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// PKCE code verifier generation (must be 43-128 characters)
function generateCodeVerifier() {
  return base64URLEncode(crypto.randomBytes(32));
}

// Generate code challenge from verifier using SHA-256
function generateCodeChallenge(verifier) {
  return base64URLEncode(crypto.createHash('sha256').update(verifier).digest());
}

// Step 1: Generate login URL for user
export function getXLoginUrl(state, req = null) {
  // Enhanced validation
  if (!clientId || !clientSecret) {
    throw new Error('X OAuth credentials not configured. Missing X_CLIENT_ID or X_CLIENT_SECRET environment variables.');
  }
  
  // Get the callback URL based on the actual request
  const requestCallbackUrl = getCallbackUrl(req);
  
  console.log('🔍 OAuth URL generation debug:');
  console.log('- State:', state);
  console.log('- Client ID:', clientId);
  console.log('- Client Secret present:', !!clientSecret);
  console.log('- Callback URL:', requestCallbackUrl);
  
  // Log the actual values to debug production issue
  console.log('🔐 Creating TwitterApi client with:');
  console.log('- Client ID length:', clientId?.length);
  console.log('- Client Secret length:', clientSecret?.length);
  console.log('- Client ID prefix:', clientId?.substring(0, 10) + '...');
  
  const client = new TwitterApi({ 
    clientId,
    clientSecret 
  });
  
  try {
    // Let twitter-api-v2 handle PKCE generation internally
    const authLink = client.generateOAuth2AuthLink(requestCallbackUrl, {
      scope: 'users.read tweet.read follows.read offline.access', // Space-separated scopes
      state
    });
    
    // Fix the lowercase s256 issue - X API requires uppercase S256
    authLink.url = authLink.url.replace('code_challenge_method=s256', 'code_challenge_method=S256');
    
    // Fix domain issue - OAuth authorization must use twitter.com, not x.com
    const originalUrl = authLink.url;
    if (authLink.url.includes('x.com')) {
      authLink.url = authLink.url.replace('x.com', 'twitter.com');
      console.log('🔧 Fixed OAuth URL domain issue:');
      console.log('- Original:', originalUrl.substring(0, 60) + '...');
      console.log('- Fixed:', authLink.url.substring(0, 60) + '...');
    }
    
    console.log('✅ OAuth link generated successfully');
    console.log('- Generated URL length:', authLink.url.length);
    console.log('- Code verifier length:', authLink.codeVerifier.length);
    console.log('- URL preview:', authLink.url.substring(0, 100) + '...');
    console.log('- Redirect URI in URL:', requestCallbackUrl);
    
    // Store the codeVerifier generated by the library
    sessions.set(state, { 
      codeVerifier: authLink.codeVerifier, 
      timestamp: Date.now() 
    });
    
    return authLink;
  } catch (error) {
    console.error('❌ Failed to generate OAuth link:', error.message);
    console.error('- Error type:', error.constructor.name);
    console.error('- Error stack:', error.stack);
    console.error('- Error details:', JSON.stringify(error, null, 2));
    
    // Check if it's a configuration issue
    if (error.message?.includes('clientId') || error.message?.includes('clientSecret')) {
      throw new Error('X OAuth configuration error: Check X_CLIENT_ID and X_CLIENT_SECRET environment variables');
    }
    
    throw new Error(`OAuth URL generation failed: ${error.message}`);
  }
}

// Step 2: Handle OAuth callback
export async function handleXCallback(code, state, req = null) {
  console.log('OAuth callback received for state:', state);

  const sessionData = sessions.get(state);
  if (!sessionData) {
    console.log('Session not found. Available sessions:', Array.from(sessions.keys()));
    throw new Error('Invalid or expired session state');
  }
  
  console.log('Session found, attempting token exchange...');
  
  // Clean up old sessions (basic cleanup)
  const now = Date.now();
  for (const [key, value] of sessions.entries()) {
    if (now - value.timestamp > 600000) { // 10 minutes
      sessions.delete(key);
    }
  }
  
  // Get the callback URL based on the actual request
  const requestCallbackUrl = getCallbackUrl(req);
  
  // Create client with explicit credentials for OAuth token exchange
  const client = new TwitterApi({ 
    clientId,
    clientSecret 
  });
  
  try {
    console.log('Token exchange details:');
    console.log('- Code:', code?.substring(0, 20) + '...');
    console.log('- Code Verifier:', sessionData.codeVerifier?.substring(0, 20) + '...');
    console.log('- Redirect URI:', requestCallbackUrl);
    console.log('- Client ID:', clientId);
    console.log('- Client Secret present:', !!clientSecret);

    // Use the explicit oauth2 token exchange method with debug logging
    console.log('Attempting token exchange with:');
    console.log('- Code length:', code?.length);
    console.log('- Code verifier length:', sessionData.codeVerifier?.length);
    console.log('- Redirect URI:', requestCallbackUrl);
    
    const tokenResponse = await client.loginWithOAuth2({
      code: code,
      codeVerifier: sessionData.codeVerifier,
      redirectUri: requestCallbackUrl,
    });

    console.log('Token response received:', {
      hasAccessToken: !!tokenResponse.accessToken,
      hasRefreshToken: !!tokenResponse.refreshToken,
      expiresIn: tokenResponse.expiresIn
    });

    const { accessToken, refreshToken, expiresIn } = tokenResponse;
    
    console.log('✅ Token exchange successful!');
    console.log('- Access token length:', accessToken?.length);
    console.log('- Refresh token length:', refreshToken?.length);
    console.log('- Expires in seconds:', expiresIn);
    
    // Calculate expiration timestamp as Date object for PostgreSQL
    const expiresAt = new Date(Date.now() + (expiresIn * 1000));
    console.log(`📅 Token will expire at: ${expiresAt.toISOString()}`);
    
    // Clean up the session
    sessions.delete(state);
    
    return {
      accessToken,
      refreshToken,
      expiresIn,
      expiresAt,
      success: true
    };
  } catch (error) {
    console.error('❌ X OAuth token exchange failed:');
    console.error('Error code:', error.code);
    console.error('Error data:', error.data);
    console.error('Error headers:', error.headers);
    console.error('Full error object:', JSON.stringify(error, null, 2));
    
    // Debug the credentials being used
    console.log('🔍 Debug info:');
    console.log('- Client ID being used:', clientId);
    console.log('- Client Secret length:', clientSecret?.length);
    console.log('- Callback URL:', callbackUrl);
    
    // Enhanced error classification
    let errorMessage = 'Authentication failed';
    
    if (error.code === 400 && error.data?.error === 'invalid_client') {
      errorMessage = 'Invalid OAuth client credentials. Check X_CLIENT_ID and X_CLIENT_SECRET environment variables.';
    } else if (error.code === 400 && error.data?.error === 'invalid_request') {
      errorMessage = 'Invalid OAuth request. This may indicate a callback URL mismatch or expired authorization code.';
    } else if (error.code === 400 && error.data?.error === 'invalid_grant') {
      errorMessage = 'Invalid authorization code. The code may have expired or been used already.';
    } else if (error.code === 401) {
      errorMessage = 'Unauthorized. Check your X API credentials and app permissions.';
    } else if (error.code === 403) {
      errorMessage = 'Forbidden. Your X app may not have the required permissions or may be suspended.';
    } else if (error.code === 404) {
      errorMessage = 'Not found. The callback URL may not be configured correctly in your X Developer Portal.';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    sessions.delete(state);
    throw new Error(errorMessage);
  }
}

// Refresh access token using refresh token
export async function refreshAccessToken(refreshToken) {
  const client = new TwitterApi({ 
    clientId,
    clientSecret 
  });
  try {
    const { accessToken, refreshToken: newRefreshToken, expiresIn } = await client.refreshOAuth2Token(refreshToken);
    return {
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn
    };
  } catch (error) {
    console.error('Token refresh failed:', error);
    throw new Error('Failed to refresh access token. Please re-authenticate.');
  }
}

// Create authenticated client with automatic token refresh
export async function createAuthenticatedClient(accessToken, refreshToken, expiresAt) {
  // Check if expired (add 5 minute buffer for safety)
  if (expiresAt && Date.now() > expiresAt - 300000) {
    if (!refreshToken) {
      throw new Error('No refresh token available. Please re-authenticate.');
    }
    
    console.log('Access token near expiry, refreshing...');
    const refreshed = await refreshAccessToken(refreshToken);
    const newExpiresAt = Date.now() + (refreshed.expiresIn * 1000);
    
    console.log('Token refreshed successfully');
    return {
      client: new TwitterApi(refreshed.accessToken),
      updatedTokens: {
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken,
        expiresAt: newExpiresAt,
      }
    };
  }
  
  // Create TwitterApi client with OAuth 2.0 User Context token
  return { 
    client: new TwitterApi(accessToken), 
    updatedTokens: null 
  };
}

// Comprehensive environment validation
export function validateXAuthEnvironment() {
  const issues = [];
  
  if (!clientId) {
    issues.push('X_CLIENT_ID environment variable is missing');
  } else if (clientId.length < 10) {
    issues.push('X_CLIENT_ID appears to be invalid (too short)');
  }
  
  if (!clientSecret) {
    issues.push('X_CLIENT_SECRET environment variable is missing');
  } else if (clientSecret.length < 10) {
    issues.push('X_CLIENT_SECRET appears to be invalid (too short)');
  }
  
  const callbackUrl = getCallbackUrl();
  if (!callbackUrl.startsWith('https://') && !callbackUrl.startsWith('http://127.0.0.1')) {
    issues.push('Callback URL must use HTTPS in production');
  }
  
  return {
    valid: issues.length === 0,
    issues,
    config: {
      clientId: clientId ? `${clientId.substring(0, 10)}...` : 'missing',
      clientSecret: clientSecret ? `${clientSecret.substring(0, 10)}...` : 'missing',
      callbackUrl
    }
  };
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