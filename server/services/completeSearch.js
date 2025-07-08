// server/services/completeSearch.js
const axios = require("axios");
const { fetchXPosts } = require("./xSearch");
const { generateHeadlines } = require("./headlineCreator");
const { fetchSupportingArticles } = require("./supportCompiler");

async function completeSearch(topics, currentHeadlines) {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  if (currentHeadlines.length >= 15) {
    return currentHeadlines;
  }

  const subtopics = {};
  for (const topic of topics) {
    try {
      const response = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content:
                "Generate 2 specific subtopics for the given topic to improve news coverage. Return as an array.",
            },
            { role: "user", content: `Topic: ${topic}` },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      subtopics[topic] = JSON.parse(response.data.choices[0].message.content);
    } catch (error) {
      console.error(`Error generating subtopics for ${topic}:`, error.response?.status, error.response?.data);
      subtopics[topic] = [];
    }
  }

  const allSubtopics = Object.values(subtopics).flat();
  const posts = await fetchXPosts(allSubtopics);
  const headlinesBySubtopic = await generateHeadlines(posts);
  const articlesBySubtopic = await fetchSupportingArticles(headlinesBySubtopic);

  const newHeadlines = [];
  for (const subtopic in headlinesBySubtopic) {
    headlinesBySubtopic[subtopic].forEach((headline, index) => {
      const articles = articlesBySubtopic[subtopic]?.find((a) => a.headline === headline.title)?.articles || [];
      newHeadlines.push({
        id: `${subtopic}-${index}`,
        title: headline.title,
        summary: headline.summary,
        category: subtopic,
        createdAt: new Date().toISOString(),
        engagement: posts[subtopic].reduce((sum, p) => sum + p.likes, 0),
        sourcePosts: posts[subtopic],
        supportingArticles: articles,
      });
    });
  }

  return [...currentHeadlines, ...newHeadlines].slice(0, 15);
}

module.exports = { completeSearch };