import { createAuthenticatedClient } from './xAuth.js';

/**
 * Fetch user's followed handles using X API v2
 * Implements: GET /2/users/:id/following
 * API Guide: https://docs.x.com/x-api/users/followers-by-user-id
 */
export async function fetchUserFollows(accessToken, userId) {
  try {
    const client = createAuthenticatedClient(accessToken);
    
    // Get user's following list with comprehensive user fields
    const response = await client.v2.following(userId, {
      'user.fields': [
        'id',
        'username', 
        'name',
        'description',
        'verified',
        'public_metrics'
      ].join(','),
      'max_results': 1000 // Maximum allowed per request
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
      followedDescription: follow.description || null,
      followedVerified: follow.verified || false,
      followersCount: follow.public_metrics?.followers_count || null,
      followingCount: follow.public_metrics?.following_count || null
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
    
    // Calculate date range for last N days
    const endTime = new Date();
    const startTime = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
    
    // Format dates for X API (ISO 8601)
    const startTimeStr = startTime.toISOString();
    const endTimeStr = endTime.toISOString();

    console.log(`Fetching timeline for user ${userId} from ${startTimeStr} to ${endTimeStr}`);

    // Fetch reverse chronological home timeline
    const response = await client.v2.userTimeline(userId, {
      'tweet.fields': [
        'id',
        'text', 
        'created_at',
        'author_id',
        'public_metrics',
        'context_annotations'
      ].join(','),
      'user.fields': [
        'id',
        'username',
        'name'
      ].join(','),
      'expansions': 'author_id',
      'start_time': startTimeStr,
      'end_time': endTimeStr,
      'max_results': 100, // Maximum per request
      'exclude': 'retweets,replies' // Focus on original posts
    });

    if (!response.data) {
      console.log('No timeline data returned from X API');
      return [];
    }

    // Create user lookup for author information
    const users = {};
    if (response.includes?.users) {
      response.includes.users.forEach(user => {
        users[user.id] = user;
      });
    }

    // Transform X API response to our database format
    const posts = response.data.map(post => {
      const author = users[post.author_id] || {};
      
      return {
        postId: post.id,
        authorId: post.author_id,
        authorHandle: author.username || 'unknown',
        authorName: author.name || null,
        text: post.text,
        createdAt: new Date(post.created_at),
        retweetCount: post.public_metrics?.retweet_count || 0,
        replyCount: post.public_metrics?.reply_count || 0,
        likeCount: post.public_metrics?.like_count || 0,
        quoteCount: post.public_metrics?.quote_count || 0,
        viewCount: post.public_metrics?.impression_count || 0,
        postUrl: `https://x.com/${author.username || 'i'}/status/${post.id}`
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