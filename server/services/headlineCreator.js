
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
        console.log(`Raw response for ${topic}:`, content);
        
        // Clean up the response and ensure it's valid JSON
        let cleanedContent = content.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '');
        
        // Fix unquoted JSON property names
        cleanedContent = cleanedContent.replace(/(\{|,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
        
        // Fix unescaped quotes in strings
        cleanedContent = cleanedContent.replace(/"([^"]*)'([^"]*)'([^"]*)"/g, '"$1\\"$2\\"$3"');
        
        // Handle problematic single quotes in JSON values
        cleanedContent = cleanedContent.replace(/:\s*'([^']*)'([^'"]*)/g, ':"$1"$2');
        
        // Fix malformed arrays
        if (!cleanedContent.startsWith('[') && !cleanedContent.startsWith('{')) {
          cleanedContent = '[' + cleanedContent + ']';
        }
        
        console.log(`Cleaned content for ${topic}:`, cleanedContent);
        
        const parsedHeadlines = JSON.parse(cleanedContent) || [];
        headlines[topic] = Array.isArray(parsedHeadlines) ? parsedHeadlines : [parsedHeadlines];
        console.log(`Successfully parsed ${headlines[topic].length} headlines for ${topic}`);
      } catch (parseError) {
        console.error(`Error parsing headlines for ${topic}:`, parseError.message);
        console.error("Raw content:", response.data.choices[0].message.content);
        
        // Try to extract headlines manually as fallback
        const content = response.data.choices[0].message.content;
        const fallbackHeadlines = [];
        
        // Look for title patterns
        const titleMatch = content.match(/"title":\s*"([^"]+)"/g);
        const summaryMatch = content.match(/"summary":\s*"([^"]+)"/g);
        
        if (titleMatch && summaryMatch && titleMatch.length === summaryMatch.length) {
          for (let i = 0; i < titleMatch.length; i++) {
            const title = titleMatch[i].match(/"title":\s*"([^"]+)"/)[1];
            const summary = summaryMatch[i].match(/"summary":\s*"([^"]+)"/)[1];
            fallbackHeadlines.push({ title, summary });
          }
        }
        
        headlines[topic] = fallbackHeadlines;
        console.log(`Fallback extraction found ${fallbackHeadlines.length} headlines for ${topic}`);
      }
    } catch (error) {
      console.error(`Error generating headlines for ${topic}:`, error.response?.status, error.response?.data || error.message);
      headlines[topic] = [];
    }
  }

  return headlines;
}

export { generateHeadlines };
