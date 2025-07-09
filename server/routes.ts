
// server/routes.ts
import express from "express";
import http from "http";
import { fetchXPosts } from "./services/xSearch.js";
import { generateHeadlines } from "./services/headlineCreator.js";
import { fetchSupportingArticles } from "./services/supportCompiler.js";
import { completeSearch } from "./services/completeSearch.js";
import { setUserTrustedSources, getUserTrustedSources } from "./services/dynamicSources.js";

export function registerRoutes(app) {
  const router = express.Router();
  let headlinesStore = [];

  router.post("/api/generate-headlines", async (req, res) => {
    const { topics } = req.body;
    if (!topics || topics.length < 1) {
      return res.status(400).json({ message: "At least 1 topic required" });
    }

    try {
      const posts = await fetchXPosts(topics);
      const hasPosts = Object.values(posts).some((p) => p.length > 0);
      if (!hasPosts) {
        throw new Error("No X posts found for any topic");
      }

      // Filter out topics with no posts before generating headlines
      const postsWithData = Object.fromEntries(
        Object.entries(posts).filter(([topic, topicPosts]) => topicPosts.length > 0)
      );

      const headlinesByTopic = await generateHeadlines(postsWithData);
      const hasHeadlines = Object.values(headlinesByTopic).some((h) => h.length > 0);
      if (!hasHeadlines) {
        throw new Error("No headlines generated from X posts");
      }

      const articlesByTopic = await fetchSupportingArticles(headlinesByTopic);

      let headlines = [];
      let usedPosts = new Set(); // Track used posts to avoid duplicates
      
      for (const topic in headlinesByTopic) {
        if (!postsWithData[topic]?.length) {
          console.warn(`Skipping ${topic}: no X posts found`);
          continue;
        }
        
        // Get available posts for this topic (not yet used)
        const availablePosts = postsWithData[topic].filter(post => 
          !usedPosts.has(post.text.substring(0, 100))
        );
        
        headlinesByTopic[topic].forEach((headline, index) => {
          // Assign unique posts to each headline (max 2 posts per headline)
          const startIndex = index * 2;
          const postsForHeadline = availablePosts.slice(startIndex, startIndex + 2);
          
          if (postsForHeadline.length === 0) {
            // If no posts available, skip this headline
            console.warn(`No available posts for headline: ${headline.title}`);
            return;
          }
          
          // Mark these posts as used
          postsForHeadline.forEach(post => 
            usedPosts.add(post.text.substring(0, 100))
          );
          
          const articles = articlesByTopic[topic]?.find((a) => a.headline === headline.title)?.articles || [];
          const engagement = postsForHeadline.reduce((sum, p) => sum + p.likes, 0);
          
          headlines.push({
            id: `${topic}-${index}`,
            title: headline.title,
            summary: headline.summary,
            category: topic,
            createdAt: new Date().toISOString(),
            engagement: engagement,
            sourcePosts: postsForHeadline,
            supportingArticles: articles,
          });
        });
      }

      if (!headlines.length) {
        throw new Error("No valid headlines generated");
      }

      headlines = await completeSearch(topics, headlines);
      headlines = headlines.sort((a, b) => b.engagement - a.engagement);
      headlinesStore = headlines;
      res.json({ success: true, headlines });
    } catch (error) {
      console.error("Error in /api/generate-headlines:", error.message);
      res.status(500).json({ message: "Failed to generate headlines: " + error.message });
    }
  });

  router.get("/api/headlines", (req, res) => {
    if (!headlinesStore.length) {
      return res.status(404).json({ headlines: [], message: "No headlines available" });
    }
    res.json({ headlines: headlinesStore.sort((a, b) => b.engagement - a.engagement) });
  });

  // User trusted sources management
  router.get("/api/user-sources/:userId", (req, res) => {
    const { userId } = req.params;
    const sources = getUserTrustedSources(userId);
    res.json({ sources });
  });

  router.post("/api/user-sources/:userId", (req, res) => {
    const { userId } = req.params;
    const { sources } = req.body;
    
    if (!Array.isArray(sources)) {
      return res.status(400).json({ error: "Sources must be an array" });
    }
    
    setUserTrustedSources(userId, sources);
    res.json({ message: "Trusted sources updated successfully" });
  });

  app.use(router);
  
  return http.createServer(app);
}
