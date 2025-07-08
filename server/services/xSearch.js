
// server/services/xSearch.js
import axios from "axios";

async function fetchXPosts(topics) {
  const XAI_API_KEY = process.env.XAI_API_KEY;
  if (!XAI_API_KEY) {
    throw new Error("XAI_API_KEY is not set");
  }

  const SINCE = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const results = {};

  for (const topic of topics) {
    try {
      const response = await axios.get("https://api.x.ai/v1/search/tweets", {
        headers: {
          Authorization: `Bearer ${XAI_API_KEY}`,
        },
        params: {
          query: topic,
          max_results: 100,
          start_time: SINCE,
          expansions: "author_id",
          "tweet.fields": "created_at,public_metrics",
          "user.fields": "username",
        },
        timeout: 20000,
      });

      const users = response.data.includes?.users || [];
      const userMap = users.reduce((map, user) => {
        map[user.id] = user.username;
        return map;
      }, {});

      let posts = response.data.data || [];
      posts = posts
        .filter((post) => new Date(post.created_at) >= new Date(SINCE))
        .map((post) => ({
          handle: userMap[post.author_id] || "unknown",
          text: post.text,
          time: post.created_at,
          url: `https://x.com/${userMap[post.author_id]}/status/${post.id}`,
          likes: post.public_metrics.like_count,
        }))
        .sort((a, b) => b.likes - a.likes)
        .slice(0, 10); // Top 10 by likes

      results[topic] = posts;
    } catch (error) {
      console.error(`Error fetching X posts for ${topic}:`, error.response?.status, error.response?.data);
      results[topic] = [];
    }
  }

  return results;
}

export { fetchXPosts };
