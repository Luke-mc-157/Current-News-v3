
// server/routes.ts
import express from "express";
import http from "http";
import { fetchXPosts } from "./services/xSearch.js";
import { generateHeadlines } from "./services/headlineCreator.js";
import { fetchSupportingArticles } from "./services/supportCompiler.js";
import { completeSearch } from "./services/completeSearch.js";

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

      const headlinesByTopic = await generateHeadlines(posts);
      const hasHeadlines = Object.values(headlinesByTopic).some((h) => h.length > 0);
      if (!hasHeadlines) {
        throw new Error("No headlines generated from X posts");
      }

      const articlesByTopic = await fetchSupportingArticles(headlinesByTopic);

      let headlines = [];
      for (const topic in headlinesByTopic) {
        if (!posts[topic]?.length) {
          console.warn(`Skipping ${topic}: no X posts found`);
          continue;
        }
        headlinesByTopic[topic].forEach((headline, index) => {
          const articles = articlesByTopic[topic]?.find((a) => a.headline === headline.title)?.articles || [];
          headlines.push({
            id: `${topic}-${index}`,
            title: headline.title,
            summary: headline.summary,
            category: topic,
            createdAt: new Date().toISOString(),
            engagement: posts[topic].reduce((sum, p) => sum + p.likes, 0),
            sourcePosts: posts[topic],
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

  app.use(router);
  
  return http.createServer(app);
}
