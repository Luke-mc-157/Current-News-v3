
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
          model: "grok-3-beta", // Updated to valid model
          messages: [
            {
              role: "system",
              content:
                "Generate realistic X posts about the given topic as if they were posted in the last 24 hours. Return ONLY a valid JSON array of exactly 10 posts. Each post must have: handle (string starting with @), text (string, realistic post content), time (ISO format string like '2025-01-08T10:00:00Z'), url (string like 'https://x.com/username/status/123456'), likes (number). No additional text, just the JSON array.",
            },
            { role: "user", content: `Topic: ${topic}` },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${XAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          timeout: 30000,
        }
      );

      let posts = [];
      try {
        const content = response.data.choices[0].message.content;
        // Extract JSON from response if it's wrapped in code blocks or text
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        const jsonContent = jsonMatch ? jsonMatch[0] : content;
        posts = JSON.parse(jsonContent);
        
        // Ensure posts is an array
        if (!Array.isArray(posts)) {
          console.warn(`Invalid response format for ${topic}: expected array, got ${typeof posts}`);
          posts = [];
        }
      } catch (parseError) {
        console.error(`JSON parsing error for ${topic}:`, parseError.message);
        posts = [];
      }

      results[topic] = posts
        .filter((post) => post && post.handle && post.text && post.time && post.url && typeof post.likes === 'number')
        .slice(0, 10);

      console.log(`Fetched ${results[topic].length} valid posts for topic: ${topic}`);
    } catch (error) {
      console.error(`Error fetching X posts for ${topic}:`, error.response?.status, error.response?.data || error.message);
      results[topic] = [];
    }
  }

  return results;
}
