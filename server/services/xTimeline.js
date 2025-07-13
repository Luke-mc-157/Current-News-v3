import { createAuthenticatedClient } from './xAuth.js';

/**
 * Fetch user's reverse chronological home timeline using X API v2
 * Implements: GET /2/users/:id/timelines/reverse_chronological  
 * API Guide: https://docs.x.com/x-api/posts/timelines/introduction#reverse-chronological-home-timeline
 * Basic tier: 15 req/15 min, max_results 100
 */
export async function fetchUserTimeline(accessToken, userId, days = 7) {
  try {
    const client = createAuthenticatedClient(accessToken);
    
    console.log(`Fetching reverse chronological home timeline for ${userId} (last 24 hours only)`);

    let posts = [];
    let nextToken = undefined;
    let pageCount = 0;
    const maxPages = 5; // Respect rate limits
    const startTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // Hardcoded to last 24 hours
    
    do {
      // Make the API call to the reverse chronological timeline endpoint
      const response = await client.v2.get(`users/${userId}/timelines/reverse_chronological`, {
        max_results: 100,
        'tweet.fields': 'id,text,created_at,author_id,public_metrics',
        expansions: 'author_id', // Get user details
        'user.fields': 'username,name', // For authorHandle and authorName
        start_time: startTime, // Time filter
        pagination_token: nextToken,
      });

      if (!response.data) {
        console.log('No timeline posts returned from X API');
        break;
      }

      // Create users map for author details
      const usersMap = new Map((response.includes?.users || []).map(u => [u.id, u]));

      // Transform and add to list
      posts.push(...response.data.map(post => ({
        postId: post.id,
        authorId: post.author_id,
        authorHandle: usersMap.get(post.author_id)?.username || 'unknown',
        authorName: usersMap.get(post.author_id)?.name || null,
        text: post.text,
        createdAt: new Date(post.created_at),
        retweetCount: post.public_metrics?.retweet_count || 0,
        replyCount: post.public_metrics?.reply_count || 0,
        likeCount: post.public_metrics?.like_count || 0,
        quoteCount: post.public_metrics?.quote_count || 0,
        viewCount: post.public_metrics?.impression_count || 0, // Often 0 for non-owned tweets
        postUrl: `https://x.com/${usersMap.get(post.author_id)?.username || 'i'}/status/${post.id}`
      })));

      nextToken = response.meta?.next_token;
      pageCount++;
    } while (nextToken && pageCount < maxPages);

    console.log(`Fetched ${posts.length} timeline posts for user ${userId} across ${pageCount} pages`);
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

    // Clean up old posts (keep only last 7 days)
    await storage.deleteOldTimelinePosts(userId, 7);

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