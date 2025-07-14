import axios from "axios";
import { categorizePostsWithXAI } from "./xaiAnalyzer.js";
import { compileVerifiedSources, buildSourceQueries } from "./dynamicSources.js";

// Track rate limit state globally
let rateLimitReset = null;
let lastRequestTime = null;

// Dynamic sources will be compiled per topic using xAI and user preferences

export async function fetchXPosts(topics, userId = 'default') {
  const X_BEARER_TOKEN = process.env.X_BEARER_TOKEN;
  if (!X_BEARER_TOKEN) {
    throw new Error("X_BEARER_TOKEN is not set in Replit Secrets");
  }

  const results = {};
  const SINCE = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(); // 48 hours for viral content to accumulate

  // Note: Using xAI for intelligent categorization instead of keyword matching

  const fetchAuthenticPosts = async (query, retryCount = 0) => {
    try {
      // Check if we need to wait for rate limit reset
      if (rateLimitReset && Date.now() < rateLimitReset) {
        const waitTime = Math.ceil((rateLimitReset - Date.now()) / 1000);
        console.log(`Rate limit active. Waiting ${waitTime} seconds for reset...`);
        await new Promise(resolve => setTimeout(resolve, rateLimitReset - Date.now() + 1000));
        rateLimitReset = null; // Clear after waiting
      }

      // Ensure minimum 5 seconds between requests
      if (lastRequestTime) {
        const timeSinceLastRequest = Date.now() - lastRequestTime;
        if (timeSinceLastRequest < 5000) {
          const waitTime = 5000 - timeSinceLastRequest;
          console.log(`Waiting ${Math.ceil(waitTime/1000)} seconds before next request...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }

      lastRequestTime = Date.now();
      
      const response = await axios.get(
        "https://api.twitter.com/2/tweets/search/recent",
        {
          params: {
            query: `${query} lang:en -is:retweet`, // Use viral query
            max_results: 100,
            "tweet.fields": "created_at,public_metrics,author_id",
            expansions: "author_id",
            "user.fields": "username",
            start_time: SINCE,
          },
          headers: {
            Authorization: `Bearer ${X_BEARER_TOKEN}`,
          },
          timeout: 15000,
        }
      );

      // Update rate limit tracking from response headers
      const remaining = response.headers['x-rate-limit-remaining'];
      const resetTime = response.headers['x-rate-limit-reset'];
      
      if (remaining !== undefined) {
        console.log(`Rate limit remaining: ${remaining}`);
      }

      const posts = response.data.data
        ? response.data.data.map((tweet, index) => {
            const username = response.data.includes?.users?.find((user) => user.id === tweet.author_id)?.username || `user${index}`;
            return {
              handle: `@${username}`,
              text: tweet.text,
              time: tweet.created_at,
              url: `https://twitter.com/${username}/status/${tweet.id}`,
              likes: tweet.public_metrics.like_count,
            };
          })
        : [];
      
      // Log engagement stats for debugging
      if (posts.length > 0) {
        const likesArray = posts.map(p => p.likes);
        console.log(`Query: ${query} - Found ${posts.length} posts. Likes range: ${Math.min(...likesArray)} to ${Math.max(...likesArray)}`);
      }

      // Return all high-engagement posts
      return posts
        .filter((post) => new Date(post.time) >= new Date(SINCE))
        .filter((post) => post.likes >= 100) // Only posts with significant engagement
        .sort((a, b) => b.likes - a.likes); // Sort by highest likes first
    } catch (error) {
      // Handle rate limiting with longer retry delays
      if (error.response?.status === 429) {
        // Extract rate limit reset time from headers
        const resetTime = error.response?.headers?.['x-rate-limit-reset'];
        if (resetTime) {
          rateLimitReset = parseInt(resetTime) * 1000; // Convert to milliseconds
          const waitTime = Math.ceil((rateLimitReset - Date.now()) / 1000);
          console.warn(`Rate limited for query. Reset in ${waitTime} seconds at ${new Date(rateLimitReset).toLocaleTimeString()}`);
        } else {
          // Fallback: wait 15 minutes if no reset header
          rateLimitReset = Date.now() + (15 * 60 * 1000);
          console.warn(`Rate limited for query. No reset header, waiting 15 minutes...`);
        }
        
        if (retryCount < 1) {
          const waitTime = Math.ceil((rateLimitReset - Date.now()) / 1000);
          console.log(`Waiting ${waitTime} seconds for rate limit reset...`);
          await new Promise(resolve => setTimeout(resolve, rateLimitReset - Date.now() + 1000));
          rateLimitReset = null; // Clear after waiting
          return fetchAuthenticPosts(query, retryCount + 1);
        }
      }
      
      console.error(`Error fetching X posts for query "${query}":`, {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        remaining: error.response?.headers?.['x-rate-limit-remaining'],
        reset: error.response?.headers?.['x-rate-limit-reset'] ? new Date(parseInt(error.response?.headers?.['x-rate-limit-reset']) * 1000).toLocaleTimeString() : 'N/A',
        message: error.message
      });
      return [];
    }
  };

  // Initialize results for all topics
  for (const topic of topics) {
    results[topic] = [];
  }

  // Compile dynamic verified sources for these topics
  const topicSources = await compileVerifiedSources(topics, userId);
  const sourceQueries = buildSourceQueries(topicSources);
  
  // Collect all authentic posts from compiled sources
  const allAuthenticPosts = [];
  let queryIndex = 0;
  
  console.log(`Searching for authentic posts from ${sourceQueries.length} compiled source queries...`);
  
  for (const sourceQuery of sourceQueries) {
    console.log(`Authentic search ${queryIndex + 1}/${sourceQueries.length}: ${sourceQuery.query} (for topic: ${sourceQuery.topic})`);
    
    const authenticPosts = await fetchAuthenticPosts(sourceQuery.query);
    allAuthenticPosts.push(...authenticPosts);
    
    queryIndex++;
    
    // Continue searching until we cover all topics or hit rate limits
    if (rateLimitReset) {
      console.log("Stopping search due to rate limit");
      break;
    }
  }

  console.log(`Found ${allAuthenticPosts.length} total authentic posts.`);

  // Remove duplicates based on post text
  const uniquePosts = Array.from(
    new Map(allAuthenticPosts.map(post => [post.text.substring(0, 100), post])).values()
  );

  console.log(`✅ Using all ${uniquePosts.length} unique posts without authenticity filtering`);

  // Use xAI for intelligent categorization  
  const categorization = await categorizePostsWithXAI(uniquePosts, topics);

  // Organize posts by topic based on xAI analysis
  for (const categoryGroup of categorization.categorizedPosts) {
    const topic = categoryGroup.topic;
    const posts = categoryGroup.posts;
    
    if (results[topic]) {
      results[topic].push(...posts.slice(0, 10)); // Limit to 10 posts per topic
      console.log(`Categorized ${posts.length} posts for topic: ${topic}`);
    }
  }

  // Log results summary
  for (const topic of topics) {
    if (results[topic].length === 0) {
      console.warn(`No viral posts found for topic: ${topic}`);
    } else {
      const likes = results[topic].map(p => p.likes).join(', ');
      console.log(`Topic "${topic}": ${results[topic].length} posts with likes: ${likes}`);
    }
  }

  return results;
}
