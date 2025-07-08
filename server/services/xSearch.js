import axios from "axios";

export async function fetchXPosts(topics) {
  const X_BEARER_TOKEN = process.env.X_BEARER_TOKEN;
  if (!X_BEARER_TOKEN) {
    throw new Error("X_BEARER_TOKEN is not set in Replit Secrets");
  }

  const results = {};
  const SINCE = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const fetchTopicPosts = async (topic) => {
    try {
      const response = await axios.get(
        "https://api.x.com/2/tweets/search/recent",
        {
          params: {
            query: `${topic} lang:en -is:retweet from:verified`, // English, no retweets, verified users
            max_results: 10,
            tweet_fields: "created_at,public_metrics,author_id",
            expansions: "author_id",
            user_fields: "username",
          },
          headers: {
            Authorization: `Bearer ${X_BEARER_TOKEN}`,
            "Content-Type": "application/json",
          },
          timeout: 15000, // 15 seconds
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
      console.error(`Error fetching X posts for ${topic}:`, error.response?.status, error.response?.data || error.message);
      return [topic, []];
    }
  };

  const promises = topics.map(fetchTopicPosts);
  const topicResults = await Promise.all(promises);
  topicResults.forEach(([topic, posts]) => {
    results[topic] = posts;
  });

  return results;
}
