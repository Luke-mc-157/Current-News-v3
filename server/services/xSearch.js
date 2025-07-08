import axios from "axios";

// Track rate limit state globally
let rateLimitReset = null;
let lastRequestTime = null;

// Broad viral-content queries that typically surface high-engagement posts
const VIRAL_QUERIES = [
  'from:Reuters OR from:AP OR from:BBCBreaking OR from:CNN OR from:FoxNews',
  'from:POTUS OR from:VP OR from:SpeakerJohnson OR from:SenSchumer',
  'from:elonmusk OR from:BillGates OR from:sundarpichai OR from:tim_cook',
  'breaking news OR just in OR BREAKING',
  'viral OR trending OR "everyone is talking about"',
  'politics OR election OR policy OR congress',
  'weather OR climate OR storm OR flood',
  'sports OR NFL OR NBA OR Premier League'
];

export async function fetchXPosts(topics) {
  const X_BEARER_TOKEN = process.env.X_BEARER_TOKEN;
  if (!X_BEARER_TOKEN) {
    throw new Error("X_BEARER_TOKEN is not set in Replit Secrets");
  }

  const results = {};
  const SINCE = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(); // 48 hours for viral content to accumulate

  // Helper function to categorize posts into topics
  const categorizePost = (postText, userTopics) => {
    const lowerText = postText.toLowerCase();
    
    for (const topic of userTopics) {
      const topicWords = topic.toLowerCase().split(' ').filter(word => word.length > 3);
      const matchCount = topicWords.filter(word => lowerText.includes(word)).length;
      
      // If at least half the topic words match, categorize it
      if (matchCount >= Math.ceil(topicWords.length / 2)) {
        return topic;
      }
    }
    
    // Check for partial matches
    for (const topic of userTopics) {
      if (lowerText.includes(topic.toLowerCase().substring(0, 10))) {
        return topic;
      }
    }
    
    return null;
  };

  const fetchViralPosts = async (query, retryCount = 0) => {
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
          return fetchViralPosts(query, retryCount + 1);
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

  // Collect all viral posts from different queries
  const allViralPosts = [];
  let queryIndex = 0;
  
  console.log(`Searching for viral posts across ${VIRAL_QUERIES.length} trending queries...`);
  
  for (const query of VIRAL_QUERIES) {
    console.log(`Viral search ${queryIndex + 1}/${VIRAL_QUERIES.length}: ${query}`);
    
    const viralPosts = await fetchViralPosts(query);
    allViralPosts.push(...viralPosts);
    
    queryIndex++;
    
    // Stop if we have enough posts or hit rate limits
    if (allViralPosts.length >= 50 || rateLimitReset) {
      break;
    }
  }

  console.log(`Found ${allViralPosts.length} total viral posts. Categorizing into topics...`);

  // Remove duplicates based on post text
  const uniquePosts = Array.from(
    new Map(allViralPosts.map(post => [post.text.substring(0, 100), post])).values()
  );

  // Categorize posts into user topics
  for (const post of uniquePosts) {
    const category = categorizePost(post.text, topics);
    
    if (category && results[category].length < 2) {
      results[category].push(post);
      console.log(`Categorized post with ${post.likes} likes into topic: ${category}`);
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
