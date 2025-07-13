import { createAuthenticatedClient } from './xAuth.js';

/**
 * Fetch user's followed handles using X API v2
 * Implements: GET /2/users/:id/following
 * API Guide: https://docs.x.com/x-api/users/followers-by-user-id
 */
export async function fetchUserFollows(accessToken, userId) {
  try {
    const client = createAuthenticatedClient(accessToken);
    
    // Basic tier: Use simpler following endpoint without advanced fields
    const response = await client.v2.following(userId, {
      'user.fields': 'id,username,name,verified',
      'max_results': 100 // Reduced for Basic tier
    });

    if (!response.data) {
      console.log('No follows data returned from X API');
      return [];
    }

    // Transform X API response to our database format
    const follows = response.data.map(follow => ({
      followedUserId: follow.id,
      followedHandle: follow.username,
      followedName: follow.name || null,
      followedDescription: null, // Not available in Basic tier
      followedVerified: follow.verified || false,
      followersCount: null, // Not available in Basic tier
      followingCount: null // Not available in Basic tier
    }));

    console.log(`Fetched ${follows.length} followed accounts for user ${userId}`);
    return follows;

  } catch (error) {
    console.error('Error fetching user follows:', error);
    
    // Handle specific X API errors
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
    
    throw new Error(`Failed to fetch user follows: ${error.message}`);
  }
}

/**
 * Fetch user's reverse chronological home timeline using X API v2
 * Implements: GET /2/users/:id/timelines/reverse_chronological  
 * API Guide: https://docs.x.com/x-api/posts/timelines/introduction#reverse-chronological-home-timeline
 */
export async function fetchUserTimeline(accessToken, userId, days = 7) {
  try {
    const client = createAuthenticatedClient(accessToken);
    
    console.log(`Fetching user tweets for ${userId} (Basic tier - user timeline only)`);

    // Use correct method for user timeline (Basic tier accessible)
    const response = await client.v2.userTimeline(userId, {
      max_results: 100, // Basic tier limit
      'tweet.fields': 'id,text,created_at,author_id,public_metrics'
    });

    console.log('Timeline response meta:', response.meta);
    console.log('Timeline data type:', typeof response.data);
    console.log('Timeline data isArray:', Array.isArray(response.data));
    console.log('Timeline data length:', response.data?.length);
    
    // Handle the response data - it should be an array
    let tweets = [];
    if (response.data && Array.isArray(response.data)) {
      tweets = response.data;
    } else if (response.data) {
      console.log('Data structure unexpected:', Object.keys(response.data));
      return [];
    } else {
      console.log('No timeline tweets returned from X API');
      return [];
    }

    if (tweets.length === 0) {
      console.log('Empty timeline data returned');
      return [];
    }

    // Transform X API response to our database format
    const posts = tweets.map(post => {
      return {
        postId: post.id,
        authorId: post.author_id,
        authorHandle: 'own_user', // Will be updated with actual handle
        authorName: null,
        text: post.text,
        createdAt: new Date(post.created_at),
        retweetCount: post.public_metrics?.retweet_count || 0,
        replyCount: post.public_metrics?.reply_count || 0,
        likeCount: post.public_metrics?.like_count || 0,
        quoteCount: post.public_metrics?.quote_count || 0,
        viewCount: post.public_metrics?.impression_count || 0,
        postUrl: `https://x.com/i/status/${post.id}`
      };
    });

    console.log(`Fetched ${posts.length} timeline posts for user ${userId}`);
    return posts;

  } catch (error) {
    console.error('Error fetching user timeline:', error);
    
    // Handle specific X API errors
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
 * Store user follows and timeline data in database
 */
export async function storeUserData(storage, userId, follows, timelinePosts) {
  try {
    // Clear existing follows for this user
    await storage.deleteUserFollows(userId);
    
    // Store new follows
    for (const follow of follows) {
      await storage.createUserFollow({
        userId,
        ...follow
      });
    }

    // Store timeline posts (check for duplicates)
    const existingPosts = await storage.getUserTimelinePosts(userId);
    const existingPostIds = new Set(existingPosts.map(p => p.postId));
    
    for (const post of timelinePosts) {
      if (!existingPostIds.has(post.postId)) {
        await storage.createUserTimelinePost({
          userId,
          ...post
        });
      }
    }

    // Clean up old posts (keep only last 7 days)
    await storage.deleteOldTimelinePosts(userId, 7);

    console.log(`Stored ${follows.length} follows and ${timelinePosts.length} timeline posts for user ${userId}`);
    
    return {
      followsStored: follows.length,
      postsStored: timelinePosts.filter(p => !existingPostIds.has(p.postId)).length,
      totalFollows: follows.length,
      totalPosts: timelinePosts.length
    };

  } catch (error) {
    console.error('Error storing user data:', error);
    throw new Error(`Failed to store user data: ${error.message}`);
  }
}