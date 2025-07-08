
const express = require("express");
const { createServer } = require("http");

// Dynamic imports for CommonJS services
let fetchXPosts;
let generateHeadlines;
let fetchSupportingArticles;
let completeSearch;

// Initialize services
const initServices = async () => {
  const xSearchModule = require("./services/xSearch");
  const headlineCreatorModule = require("./services/headlineCreator");
  const supportCompilerModule = require("./services/supportCompiler");
  const completeSearchModule = require("./services/completeSearch");
  
  fetchXPosts = xSearchModule.fetchXPosts;
  generateHeadlines = headlineCreatorModule.generateHeadlines;
  fetchSupportingArticles = supportCompilerModule.fetchSupportingArticles;
  completeSearch = completeSearchModule.completeSearch;
};

async function registerRoutes(app) {
  // Initialize services on first use
  let servicesInitialized = false;

  // Store headlines in memory (replace with database in production)
  let headlinesStore = [];

  app.post("/api/generate-headlines", async (req, res) => {
    // Initialize services if not already done
    if (!servicesInitialized) {
      await initServices();
      servicesInitialized = true;
    }
    
    const { topics } = req.body;
    if (!topics || topics.length < 5) {
      return res.status(400).json({ message: "At least 5 topics required" });
    }

    try {
      const posts = await fetchXPosts(topics);
      
      // Validate that we have actual posts
      const hasPosts = Object.values(posts).some((p) => p.length > 0);
      if (!hasPosts) {
        throw new Error("No X posts found for any topic");
      }

      const headlinesByTopic = await generateHeadlines(posts);
      
      // Validate that we have actual headlines
      const hasHeadlines = Object.values(headlinesByTopic).some((h) => h.length > 0);
      if (!hasHeadlines) {
        throw new Error("No headlines generated from X posts");
      }

      const articlesByTopic = await fetchSupportingArticles(headlinesByTopic);

      let headlines = [];
      for (const topic in headlinesByTopic) {
        // Skip topics without posts
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

      // Final validation - ensure we have valid headlines
      if (!headlines.length) {
        throw new Error("No valid headlines generated");
      }

      // Sort headlines by engagement (highest first)
      headlines = headlines.sort((a, b) => b.engagement - a.engagement);

      // Run complete search if needed
      headlines = await completeSearch(topics, headlines);
      
      // Sort again after adding subtopic headlines
      headlines = headlines.sort((a, b) => b.engagement - a.engagement);

      headlinesStore = headlines;
      res.json({ success: true, headlines });
    } catch (error) {
      console.error("Error in /api/generate-headlines:", error.message);
      res.status(500).json({ message: "Failed to generate headlines: " + error.message });
    }
  });

  app.get("/api/headlines", (req, res) => {
    if (!headlinesStore.length) {
      return res.status(404).json({ headlines: [], message: "No headlines available" });
    }
    // Ensure headlines are sorted by engagement when fetched
    const sortedHeadlines = headlinesStore.sort((a, b) => b.engagement - a.engagement);
    res.json({ headlines: sortedHeadlines });
  });

  const server = createServer(app);
  return server;
}

module.exports = { registerRoutes };
