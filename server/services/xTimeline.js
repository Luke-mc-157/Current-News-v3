import { createAuthenticatedClient } from './xAuth.js';
import { storage } from '../storage.js';

/**
 * Fetch user's reverse chronological home timeline using X API v2
 * Implements: GET /2/users/:id/timelines/reverse_chronological  
 * API Guide: https://docs.x.com/x-api/posts/timelines/introduction#reverse-chronological-home-timeline
 * Basic tier: 15 req/15 min, max_results 100
 */
export async function fetchUserTimeline(userId, days = 7) {
  try {
    // Get full token data from database
    const tokenData = await storage.getXAuthTokenByUserId(userId);
    if (!tokenData) {
      throw new Error('No authentication tokens found for user. Please re-authenticate.');
    }

    console.log('Retrieved token data:', {
      hasAccessToken: !!tokenData.accessToken,
      hasRefreshToken: !!tokenData.refreshToken,
      expiresAt: tokenData.expiresAt
    });

    // Create authenticated client with full token data
    const result = await createAuthenticatedClient(
      tokenData.accessToken, 
      tokenData.refreshToken, 
      tokenData.expiresAt
    );
    
    if (!result || !result.client) {
      throw new Error('Failed to create authenticated client');
    }

    // Extract the actual TwitterApi client
    const client = result.client;
    
    // Update tokens in database if they were refreshed
    if (result.updatedTokens) {
      console.log('Updating refreshed tokens in database...');
      await storage.updateXAuthToken(userId, {
        accessToken: result.updatedTokens.accessToken,
        refreshToken: result.updatedTokens.refreshToken,
        expiresAt: new Date(result.updatedTokens.expiresAt)
      });
      console.log('✅ Updated refreshed tokens in database');
    }
    
    console.log(`Fetching reverse chronological home timeline for ${userId} (last 24 hours only)`);

    let posts = [];
    let nextToken = undefined;
    let pageCount = 0;
    const maxPages = 5; // Respect rate limits
    const maxPosts = 200; // Target 200 posts
    const cutoffTime = new Date(Date.now() - days * 24 * 60 * 60 * 1000); // Filter posts by specified days
    
    do {
      // Make the API call to the reverse chronological timeline endpoint using correct method
      console.log('Making API call with client:', !!client);
      console.log('Client.v2 exists:', !!client.v2);
      const response = await client.v2.homeTimeline({ // Fixed: Use homeTimeline method for reverse chronological home feed
        max_results: 100,
        'tweet.fields': 'id,text,created_at,author_id,public_metrics', // Simplified for timeline API
        expansions: 'author_id', // Focus only on author data for timeline
        'user.fields': 'id,username,name', // Include id field to ensure proper mapping
        pagination_token: nextToken,
      });

      console.log('Timeline API response structure:', {
        hasResponseData: !!response.data,
        hasRealData: !!response._realData,
        responseDataType: typeof response.data,
        responseKeys: Object.keys(response),
        tweetsLength: response.tweets?.length,
        dataLength: response.data?.length,
        hasIncludes: !!response.includes,
        usersCount: response.includes?.users?.length || 0,
        hasRealDataIncludes: !!response._realData?.includes,
        realDataUsersCount: response._realData?.includes?.users?.length || 0
      });

      // Extract the actual tweets from the response - twitter-api-v2 may wrap data differently
      const tweets = response.tweets || response.data || response._realData?.data;
      
      if (!tweets || !Array.isArray(tweets)) {
        console.log('No timeline posts returned from X API or tweets is not an array');
        console.log('Tweets:', tweets);
        console.log('Response structure:', JSON.stringify(response, null, 2));
        break;
      }

      // Create users map for author details
      const users = response.includes?.users || response._realData?.includes?.users || [];
      console.log(`📥 Extracted ${users.length} users from API response`);
      
      if (users.length > 0) {
        console.log('✅ Sample user data:', JSON.stringify(users[0], null, 2));
      } else {
        console.log('⚠️ No user data found in response includes');
        console.log('🔍 Full response structure:', JSON.stringify({
          includes: response.includes,
          _realData: response._realData?.includes
        }, null, 2));
      }
      
      const usersMap = new Map(users.map(u => [u.id, u]));
      console.log(`🗺️ Created usersMap with ${usersMap.size} entries`);

      // Transform posts without date filtering for testing
      const transformedPosts = tweets.map(post => {
        const user = usersMap.get(post.author_id);
        const authorHandle = user?.username || 'unknown';
        const authorName = user?.name || user?.username || 'Unknown User';
        
        // Debug first few posts
        if (posts.length < 3) {
          console.log(`🐦 Post ${posts.length + 1} author data:`, {
            authorId: post.author_id,
            foundUser: !!user,
            userFields: user ? Object.keys(user) : [],
            authorHandle,
            authorName
          });
        }
        
        return {
          postId: post.id,
          authorId: post.author_id,
          authorHandle,
          authorName,
          text: post.text,
          createdAt: new Date(post.created_at),
          retweetCount: post.public_metrics?.retweet_count || 0,
          replyCount: post.public_metrics?.reply_count || 0,
          likeCount: post.public_metrics?.like_count || 0,
          quoteCount: post.public_metrics?.quote_count || 0,
          viewCount: post.public_metrics?.impression_count || 0,
          postUrl: `https://x.com/${authorHandle}/status/${post.id}`
        };
      });
      
      posts.push(...transformedPosts);
      console.log(`Page ${pageCount + 1}: ${tweets.length} total posts, ${transformedPosts.length} transformed posts`);
      console.log(`Sample transformed post:`, JSON.stringify(transformedPosts[0], null, 2));

      nextToken = response.meta?.next_token || response._realData?.meta?.next_token;
      pageCount++;
      
      console.log(`Current posts count: ${posts.length}, Target: ${maxPosts}, Next token: ${nextToken ? 'available' : 'none'}`);
      
      // Stop if we've reached the target number of posts
      if (posts.length >= maxPosts) {
        console.log(`Reached target of ${maxPosts} posts, stopping pagination`);
        break;
      }
      
      // Stop if no more pages available
      if (!nextToken) {
        console.log(`No more pages available, stopping at ${posts.length} posts`);
        break;
      }
    } while (nextToken && pageCount < maxPages);

    // Trim to exactly 175 posts if we fetched more
    if (posts.length > maxPosts) {
      posts = posts.slice(0, maxPosts);
      console.log(`Trimmed to ${maxPosts} most recent posts`);
    }
    
    console.log(`Fetched ${posts.length} timeline posts for user ${userId} across ${pageCount} pages`);
    
    // Store timeline posts in database
    if (posts.length > 0) {
      console.log(`💾 Storing ${posts.length} timeline posts in database...`);
      await storeUserData(storage, userId, [], posts);
      console.log(`✅ Timeline posts successfully stored in database`);
    } else {
      console.log(`⚠️ No timeline posts to store`);
    }
    
    return posts;

  } catch (error) {
    console.error('Error fetching user timeline:', error);
    console.error('Full error data:', JSON.stringify(error.data, null, 2));
    
    if (error.code === 429) {
      throw new Error('X API rate limit exceeded. Please try again later.');
    } else if (error.code === 401) {
      throw new Error('X API authentication failed. Please re-authenticate.');
    } else if (error.code === 403) {
      if (error.data?.reason === 'client-not-enrolled') {
        throw new Error('X App must be attached to a Project. Visit https://developer.twitter.com/en/docs/projects/overview');
      }
      throw new Error('X API access forbidden. Check your API permissions.');
    }
    
    throw new Error(`Failed to fetch user timeline: ${error.message}`);
  }
}

/**
 * Store user timeline data in database
 */
export async function storeUserData(storage, userId, follows, timelinePosts) {
  try {
    // Since we're not using follows anymore, just store timeline posts
    
    // Store timeline posts (check for duplicates by postId)
    const existingPosts = await storage.getUserTimelinePosts(userId);
    const existingPostIds = new Set(existingPosts.map(p => p.postId));
    
    let storedPosts = 0;
    for (const post of timelinePosts) {
      if (!existingPostIds.has(post.postId)) {
        await storage.createUserTimelinePost({
          userId,
          ...post
        });
        storedPosts++;
      }
    }

    // Clean up old posts (keep only last 30 hours)
    await storage.deleteOldTimelinePosts(userId, 30);

    console.log(`Stored ${storedPosts} new timeline posts for user ${userId}`);
    
    return {
      followsStored: 0, // Not using follows anymore
      postsStored: storedPosts,
      totalFollows: 0,
      totalPosts: timelinePosts.length
    };

  } catch (error) {
    console.error('Error storing user data:', error);
    throw new Error(`Failed to store user data: ${error.message}`);
  }
}