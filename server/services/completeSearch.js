
import axios from "axios";
import { fetchXPosts } from "./xSearch.js";
import { generateHeadlines } from "./headlineCreator.js";
import { fetchSupportingArticles } from "./supportCompiler.js";

async function completeSearch(topics, currentHeadlines) {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set in Replit Secrets");
  }

  if (currentHeadlines.length >= 15) {
    return currentHeadlines.sort((a, b) => b.engagement - a.engagement);
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
                "Generate 2 specific subtopics for the given topic to improve news coverage. Return as JSON array.",
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

      subtopics[topic] = JSON.parse(response.data.choices[0].message.content) || [];
    } catch (error) {
      console.error(`Error generating subtopics for ${topic}:`, error.response?.status, error.response?.data || error.message);
      subtopics[topic] = [];
    }
  }

  const allSubtopics = Object.values(subtopics).flat();
  if (!allSubtopics.length) {
    console.warn("No subtopics generated, returning current headlines");
    return currentHeadlines.sort((a, b) => b.engagement - a.engagement);
  }

  const posts = await fetchXPosts(allSubtopics);
  const hasPosts = Object.values(posts).some((p) => p.length > 0);
  if (!hasPosts) {
    console.warn("No posts found for subtopics, returning current headlines");
    return currentHeadlines.sort((a, b) => b.engagement - a.engagement);
  }

  const headlinesBySubtopic = await generateHeadlines(posts);
  const articlesBySubtopic = await fetchSupportingArticles(headlinesBySubtopic);

  const newHeadlines = [];
  let usedSubtopicPosts = new Set();
  
  for (const subtopic in headlinesBySubtopic) {
    if (!posts[subtopic]?.length) {
      console.warn(`Skipping subtopic ${subtopic}: no X posts found`);
      continue;
    }
    
    // Get available posts for this subtopic (not yet used)
    const availablePosts = posts[subtopic].filter(post => 
      !usedSubtopicPosts.has(post.text.substring(0, 100))
    );
    
    headlinesBySubtopic[subtopic].forEach((headline, index) => {
      // Assign unique posts to each headline (max 2 posts per headline)
      const startIndex = index * 2;
      const postsForHeadline = availablePosts.slice(startIndex, startIndex + 2);
      
      if (postsForHeadline.length === 0) {
        console.warn(`No available posts for subtopic headline: ${headline.title}`);
        return;
      }
      
      // Mark these posts as used
      postsForHeadline.forEach(post => 
        usedSubtopicPosts.add(post.text.substring(0, 100))
      );
      
      const articles = articlesBySubtopic[subtopic]?.find((a) => a.headline === headline.title)?.articles || [];
      const engagement = postsForHeadline.reduce((sum, p) => sum + p.likes, 0);
      
      // Find parent topic for categorization
      let parentTopic = 'General';
      for (const [topic, subs] of Object.entries(subtopics)) {
        if (subs.includes(subtopic)) {
          parentTopic = topic;
          break;
        }
      }
      
      newHeadlines.push({
        id: `${subtopic}-${index}`,
        title: headline.title,
        summary: headline.summary,
        category: parentTopic, // Use parent topic instead of subtopic
        createdAt: new Date().toISOString(),
        engagement: engagement,
        sourcePosts: postsForHeadline,
        supportingArticles: articles,
      });
    });
  }

  return [...currentHeadlines, ...newHeadlines]
    .sort((a, b) => b.engagement - a.engagement)
    .slice(0, 15);
}

export { completeSearch };
