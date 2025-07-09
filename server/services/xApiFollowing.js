import crypto from "crypto";
import axios from "axios";

// X API OAuth 1.0a authentication
function generateAuthHeader(url, method, params = {}) {
  const accessToken = process.env.X_ACCESS_TOKEN;
  const accessTokenSecret = process.env.X_ACCESS_TOKEN_SECRET;
  const consumerKey = process.env.X_CONSUMER_KEY;
  const consumerSecret = process.env.X_CONSUMER_SECRET;

  if (!accessToken || !accessTokenSecret || !consumerKey || !consumerSecret) {
    throw new Error("X API OAuth credentials not configured. Please add X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET, X_CONSUMER_KEY, and X_CONSUMER_SECRET to your Replit Secrets.");
  }

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

  // Combine oauth params with request params
  const allParams = { ...oauthParams, ...params };
  
  // Create parameter string
  const paramString = Object.keys(allParams)
    .sort()
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(allParams[key])}`)
    .join('&');

  // Create signature base string
  const signatureBaseString = `${method.toUpperCase()}&${encodeURIComponent(url)}&${encodeURIComponent(paramString)}`;

  // Create signing key
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(accessTokenSecret)}`;

  // Generate signature
  const signature = crypto.createHmac('sha1', signingKey).update(signatureBaseString).digest('base64');
  
  // Add signature to oauth params
  oauthParams.oauth_signature = signature;

  // Create Authorization header
  const authHeader = 'OAuth ' + Object.keys(oauthParams)
    .map(key => `${encodeURIComponent(key)}="${encodeURIComponent(oauthParams[key])}"`)
    .join(', ');

  return authHeader;
}

// Cache for followed handles to avoid excessive API calls
const followingCache = new Map();
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

export async function fetchUserFollowing(username) {
  try {
    // Check cache first
    const cacheKey = username.toLowerCase();
    const cached = followingCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log(`Using cached following list for @${username} (${cached.handles.length} accounts)`);
      return cached.handles;
    }

    console.log(`Fetching following list for @${username}...`);

    // Step 1: Get user ID from username
    const userUrl = `https://api.twitter.com/2/users/by/username/${username}`;
    const userAuth = generateAuthHeader(userUrl, 'GET');
    
    console.log(`Requesting user info for @${username}...`);
    const userResponse = await axios.get(userUrl, {
      headers: {
        'Authorization': userAuth,
        'Content-Type': 'application/json'
      }
    });

    if (!userResponse.data.data || !userResponse.data.data.id) {
      throw new Error(`User @${username} not found`);
    }

    const userId = userResponse.data.data.id;
    console.log(`Found user ID ${userId} for @${username}`);

    // Step 2: Get following list
    const followingHandles = [];
    let nextToken = null;
    let requestCount = 0;
    const maxRequests = 5; // Limit to avoid excessive API usage

    do {
      requestCount++;
      const followingUrl = `https://api.twitter.com/2/users/${userId}/following`;
      const params = {
        'max_results': '1000',
        'user.fields': 'username'
      };
      
      if (nextToken) {
        params.pagination_token = nextToken;
      }

      const followingAuth = generateAuthHeader(followingUrl, 'GET', params);
      
      const followingResponse = await axios.get(followingUrl, {
        headers: {
          'Authorization': followingAuth,
          'Content-Type': 'application/json'
        },
        params
      });

      if (followingResponse.data.data) {
        const handles = followingResponse.data.data.map(user => user.username);
        followingHandles.push(...handles);
        console.log(`Fetched ${handles.length} following accounts (batch ${requestCount})`);
      }

      nextToken = followingResponse.data.meta?.next_token;
    } while (nextToken && requestCount < maxRequests);

    console.log(`Total following accounts fetched for @${username}: ${followingHandles.length}`);

    // Cache the result
    followingCache.set(cacheKey, {
      handles: followingHandles,
      timestamp: Date.now()
    });

    return followingHandles;

  } catch (error) {
    console.error("X API following fetch error:", error.response?.data || error.message);
    if (error.response?.status === 401) {
      throw new Error(`OAuth authentication failed. Please check your X API credentials have the correct permissions.`);
    } else if (error.response?.status === 403) {
      throw new Error(`Access denied for @${username}. The account may be private or you may not have permission to view their following list.`);
    } else if (error.response?.status === 404) {
      throw new Error(`User @${username} not found`);
    } else if (error.response?.status === 429) {
      throw new Error(`Rate limit exceeded while fetching following list for @${username}. Please try again later.`);
    } else {
      throw new Error(`Failed to fetch following list for @${username}: ${error.message}`);
    }
  }
}

// Clear cache periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of followingCache.entries()) {
    if (now - value.timestamp > CACHE_DURATION) {
      followingCache.delete(key);
    }
  }
}, CACHE_DURATION);