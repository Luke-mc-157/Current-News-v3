import axios from "axios";

export async function fetchXPosts(topics) {
  const X_BEARER_TOKEN = process.env.X_BEARER_TOKEN;
  if (!X_BEARER_TOKEN) {
    throw new Error("X_BEARER_TOKEN is not set in Replit Secrets");
  }

  const results = {};
  const SINCE = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const fetchTopicPosts = async (topic, retryCount = 0) => {
    try {
      // Add delay between requests to avoid rate limiting
      if (retryCount > 0) {
        await new Promise(resolve => setTimeout(resolve, 2000 * retryCount));
      }
      
      const response = await axios.get(
        "https://api.x.com/2/tweets/search/recent",
        {
          params: {
            query: `${topic} lang:en -is:retweet`, // English, no retweets
            max_results: 10,
            "tweet.fields": "created_at,public_metrics,author_id",
            expansions: "author_id",
            "user.fields": "username",
          },
          headers: {
            Authorization: `Bearer ${X_BEARER_TOKEN}`,
          },
          timeout: 15000,
        }
      );

      const posts = response.data.data
        ? response.data.data.map((tweet, index) => ({
            handle: response.data.includes.users.find((user) => user.id === tweet.author_id)?.username || `user${index}`,
            text: tweet.text,
            time: tweet.created_at,
            url: `https://x.com/${response.data.includes.users.find((user) => user.id === tweet.author_id)?.username}/status/${tweet.id}`,
            likes: tweet.public_metrics.like_count,
          }))
        : [];

      const filteredPosts = posts
        .filter((post) => new Date(post.time) >= new Date(SINCE))
        .sort((a, b) => b.likes - a.likes) // Rank by engagement (likes)
        .slice(0, 5); // Top 5 posts, matching Grok 3

      if (!filteredPosts.length) {
        console.warn(`No posts found for topic: ${topic}`);
      } else {
        console.log(`Fetched ${filteredPosts.length} posts for topic: ${topic}`);
      }
      return [topic, filteredPosts];
    } catch (error) {
      // Handle rate limiting with retry
      if (error.response?.status === 429 && retryCount < 2) {
        console.warn(`Rate limited for ${topic}, retrying in ${2 * (retryCount + 1)} seconds...`);
        await new Promise(resolve => setTimeout(resolve, 2000 * (retryCount + 1)));
        return fetchTopicPosts(topic, retryCount + 1);
      }
      
      console.error(`Error fetching X posts for ${topic}:`, error.response?.status, error.response?.data || error.message);
      return [topic, []];
    }
  };

  // Process topics sequentially to avoid rate limiting
  for (let i = 0; i < topics.length; i++) {
    const topic = topics[i];
    if (i > 0) {
      // Add delay between requests to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    const [topicName, posts] = await fetchTopicPosts(topic);
    results[topicName] = posts;
  }

  return results;
}
