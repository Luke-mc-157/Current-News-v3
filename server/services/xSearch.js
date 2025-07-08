import axios from "axios";

// Track rate limit state globally
let rateLimitReset = null;
let lastRequestTime = null;

export async function fetchXPosts(topics) {
  const X_BEARER_TOKEN = process.env.X_BEARER_TOKEN;
  if (!X_BEARER_TOKEN) {
    throw new Error("X_BEARER_TOKEN is not set in Replit Secrets");
  }

  const results = {};
  const SINCE = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const fetchTopicPosts = async (topic, retryCount = 0) => {
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
            query: `${topic.replace(/['"]/g, '').substring(0, 200)} lang:en -is:retweet`, // Search broadly to get more results
            max_results: 100,
            "tweet.fields": "created_at,public_metrics,author_id",
            expansions: "author_id",
            "user.fields": "username",
            start_time: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // Last 7 days for more viral content
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
        console.log(`Topic: ${topic} - Found ${posts.length} posts. Likes range: ${Math.min(...likesArray)} to ${Math.max(...likesArray)}`);
      }

      // Sort all posts by engagement and take the top 2
      const filteredPosts = posts
        .filter((post) => new Date(post.time) >= new Date(SINCE))
        .sort((a, b) => b.likes - a.likes) // Sort by highest likes first
        .slice(0, 2); // Get the 2 posts with highest engagement

      if (!filteredPosts.length) {
        console.warn(`No posts found for topic: ${topic}`);
      } else {
        console.log(`Fetched ${filteredPosts.length} posts for topic: ${topic}`);
      }
      return [topic, filteredPosts];
    } catch (error) {
      // Handle rate limiting with longer retry delays
      if (error.response?.status === 429) {
        // Extract rate limit reset time from headers
        const resetTime = error.response?.headers?.['x-rate-limit-reset'];
        if (resetTime) {
          rateLimitReset = parseInt(resetTime) * 1000; // Convert to milliseconds
          const waitTime = Math.ceil((rateLimitReset - Date.now()) / 1000);
          console.warn(`Rate limited for ${topic}. Reset in ${waitTime} seconds at ${new Date(rateLimitReset).toLocaleTimeString()}`);
        } else {
          // Fallback: wait 15 minutes if no reset header
          rateLimitReset = Date.now() + (15 * 60 * 1000);
          console.warn(`Rate limited for ${topic}. No reset header, waiting 15 minutes...`);
        }
        
        if (retryCount < 1) {
          const waitTime = Math.ceil((rateLimitReset - Date.now()) / 1000);
          console.log(`Waiting ${waitTime} seconds for rate limit reset...`);
          await new Promise(resolve => setTimeout(resolve, rateLimitReset - Date.now() + 1000));
          rateLimitReset = null; // Clear after waiting
          return fetchTopicPosts(topic, retryCount + 1);
        }
      }
      
      console.error(`Error fetching X posts for ${topic}:`, {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        remaining: error.response?.headers?.['x-rate-limit-remaining'],
        reset: error.response?.headers?.['x-rate-limit-reset'] ? new Date(parseInt(error.response?.headers?.['x-rate-limit-reset']) * 1000).toLocaleTimeString() : 'N/A',
        message: error.message
      });
      return [topic, []];
    }
  };

  // Process topics sequentially to avoid rate limiting
  for (let i = 0; i < topics.length; i++) {
    const topic = topics[i];
    console.log(`Processing topic ${i + 1}/${topics.length}: ${topic}`);
    const [topicName, posts] = await fetchTopicPosts(topic);
    results[topicName] = posts;
  }

  return results;
}
