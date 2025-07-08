import express, { type Express } from "express";
import { createServer, type Server } from "http";

// Dynamic imports for CommonJS services
let fetchXPosts: any;
let generateHeadlines: any;
let fetchSupportingArticles: any;
let completeSearch: any;

// Initialize services
const initServices = async () => {
  const xSearchModule = await import("./services/xSearch.js");
  const headlineCreatorModule = await import("./services/headlineCreator.js");
  const supportCompilerModule = await import("./services/supportCompiler.js");
  const completeSearchModule = await import("./services/completeSearch.js");
  
  fetchXPosts = xSearchModule.fetchXPosts;
  generateHeadlines = headlineCreatorModule.generateHeadlines;
  fetchSupportingArticles = supportCompilerModule.fetchSupportingArticles;
  completeSearch = completeSearchModule.completeSearch;
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize services on first use
  let servicesInitialized = false;

  // Store headlines in memory (replace with database in production)
  let headlinesStore: any[] = [];

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
      const headlinesByTopic = await generateHeadlines(posts);
      const articlesByTopic = await fetchSupportingArticles(headlinesByTopic);

      let headlines: any[] = [];
      for (const topic in headlinesByTopic) {
        headlinesByTopic[topic].forEach((headline: any, index: number) => {
          const articles = articlesByTopic[topic]?.find((a: any) => a.headline === headline.title)?.articles || [];
          headlines.push({
            id: `${topic}-${index}`,
            title: headline.title,
            summary: headline.summary,
            category: topic,
            createdAt: new Date().toISOString(),
            engagement: posts[topic].reduce((sum: number, p: any) => sum + p.likes, 0),
            sourcePosts: posts[topic],
            supportingArticles: articles,
          });
        });
      }

      headlines = await completeSearch(topics, headlines);
      headlinesStore = headlines;
      res.json({ success: true, headlines });
    } catch (error: any) {
      console.error("Error in /api/generate-headlines:", error.message);
      res.status(500).json({ message: "Failed to generate headlines" });
    }
  });

  app.get("/api/headlines", (req, res) => {
    res.json({ headlines: headlinesStore });
  });

  const server = createServer(app);
  return server;
}