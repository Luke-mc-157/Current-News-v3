
// server/services/xSearch.js
import axios from "axios";

export async function fetchXPosts(topics) {
  const XAI_API_KEY = process.env.XAI_API_KEY;
  if (!XAI_API_KEY) {
    throw new Error("XAI_API_KEY is not set in Replit Secrets");
  }

  const results = {};
  const SINCE = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  for (const topic of topics) {
    try {
      const response = await axios.post(
        "https://api.x.ai/v1/chat/completions",
        {
          model: "grok-beta",
          messages: [
            {
              role: "system",
              content:
                "Search X for recent posts (last 24 hours) about the given topic. Return an array of up to 10 posts, each with handle, text, time (ISO format), URL, and likes. Use only real-time X data. If no posts are found, return an empty array.",
            },
            { role: "user", content: `Topic: ${topic}` },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${XAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          timeout: 20000,
        }
      );

      const posts = JSON.parse(response.data.choices[0].message.content) || [];
      results[topic] = posts
        .filter((post) => new Date(post.time) >= new Date(SINCE))
        .sort((a, b) => b.likes - a.likes)
        .slice(0, 10);

      if (!posts.length) {
        console.warn(`No posts found for topic: ${topic}`);
      }
    } catch (error) {
      console.error(`Error fetching X posts for ${topic}:`, error.response?.status, error.response?.data || error.message);
      results[topic] = [];
    }
  }

  return results;
}
