
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
                "Generate 1-2 news headlines using ONLY the exact information from X posts. RULES: 1) NO invented details, numbers, or names not in posts 2) Extract main topics/themes only 3) Prefer vague headlines over specific claims 4) Examples: 'Political discussions around border security' NOT 'President announces new border policy' 5) 'Weather concerns in Texas region' NOT 'Texas Governor reports 161 missing'. Return JSON: [{title: string, summary: string}]",
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

      try {
        const content = response.data.choices[0].message.content;
        // Clean up the response and ensure it's valid JSON
        let cleanedContent = content.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '');
        
        // Fix unquoted JSON property names
        cleanedContent = cleanedContent.replace(/(\{|,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
        
        headlines[topic] = JSON.parse(cleanedContent) || [];
      } catch (parseError) {
        console.error(`Error parsing headlines for ${topic}:`, parseError.message, "Raw content:", response.data.choices[0].message.content);
        headlines[topic] = [];
      }
    } catch (error) {
      console.error(`Error generating headlines for ${topic}:`, error.response?.status, error.response?.data || error.message);
      headlines[topic] = [];
    }
  }

  return headlines;
}

export { generateHeadlines };
