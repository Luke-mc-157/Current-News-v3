
// server/services/headlineCreator.js
import axios from "axios";

async function generateHeadlines(postsByTopic) {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set in Replit Secrets");
  }

  const headlines = {};

  for (const topic in postsByTopic) {
    const posts = postsByTopic[topic]
      .sort((a, b) => b.likes - a.likes)
      .slice(0, 5)
      .map((post) => post.text);

    if (!posts.length) {
      console.warn(`No posts available for ${topic}, skipping headline generation`);
      headlines[topic] = [];
      continue;
    }

    try {
      const response = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content:
                "Generate 1-2 factual, declarative news headlines and summaries based solely on the provided X posts from the last 24 hours. Do not invent information or use external knowledge. If insufficient data, return an empty array. Return as JSON: [{title: string, summary: string}, ...]",
            },
            { role: "user", content: `Topic: ${topic}\nPosts: ${posts.join("\n")}` },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      headlines[topic] = JSON.parse(response.data.choices[0].message.content) || [];
    } catch (error) {
      console.error(`Error generating headlines for ${topic}:`, error.response?.status, error.response?.data || error.message);
      headlines[topic] = [];
    }
  }

  return headlines;
}

export { generateHeadlines };
