import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserTopicsSchema, insertPodcastSettingsSchema } from "@shared/schema";
import { findSupportingArticles } from "./workflows/support-compiler";
import { organizeResults } from "./workflows/results-engine";
import { generateSubtopics } from "./workflows/complete-search";
import { log } from "./vite";

// Import JavaScript services using dynamic imports
let fetchXPosts: any;
let generateHeadlines: any;
let completeSearch: any;

// Initialize services
const initServices = async () => {
  const xSearchModule = await import("./services/xSearch.js");
  const headlineCreatorModule = await import("./services/headlineCreator.js");
  const completeSearchModule = await import("./services/completeSearch.js");
  fetchXPosts = xSearchModule.fetchXPosts;
  generateHeadlines = headlineCreatorModule.generateHeadlines;
  completeSearch = completeSearchModule.completeSearch;
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize services on first use
  let servicesInitialized = false;

  // Generate headlines based on user topics
  app.post(
    "/api/generate-headlines", 
    async (req, res) => {
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
        let headlines = [];
        for (const topic in headlinesByTopic) {
          headlinesByTopic[topic].forEach((headline: any, index: number) => {
            headlines.push({
              id: `${topic}-${index}`,
              title: headline.title,
              summary: headline.summary,
              category: topic,
              createdAt: new Date().toISOString(),
              engagement: posts[topic].reduce((sum: number, p: any) => sum + p.likes, 0),
              sourcePosts: posts[topic],
              supportingArticles: [],
            });
          });
        }

        headlines = await completeSearch(topics, headlines);
        
        // Store all headlines
        for (const headline of headlines) {
          await storage.createHeadline(headline);
        }

        res.json({ success: true, headlines });
      } catch (error) {
        console.error("Error in /api/generate-headlines:", error);
        res.status(500).json({ message: "Failed to generate headlines" });
      }
    }
  );

  // Get all headlines
  app.get("/api/headlines", async (req, res) => {
    try {
      const headlines = await storage.getHeadlines();
      res.json({ headlines });
    } catch (error) {
      console.error("Error fetching headlines:", error);
      res.status(500).json({ message: "Failed to fetch headlines" });
    }
  });

  // Save podcast settings
  app.post("/api/podcast-settings", async (req, res) => {
    try {
      const parsed = insertPodcastSettingsSchema.parse(req.body);
      const settings = await storage.createPodcastSettings(parsed);
      res.json({ settings });
    } catch (error) {
      console.error("Error saving podcast settings:", error);
      res.status(500).json({ message: "Failed to save podcast settings" });
    }
  });

  // Don't add a catch-all 404 handler here because Vite needs to handle non-API routes

  const server = createServer(app);
  return server;
}

function determineCategory(topic: string): string {
  const lowerTopic = topic.toLowerCase();
  if (lowerTopic.includes('tech') || lowerTopic.includes('ai') || lowerTopic.includes('software')) {
    return 'Technology';
  } else if (lowerTopic.includes('business') || lowerTopic.includes('finance') || lowerTopic.includes('market')) {
    return 'Business';
  } else if (lowerTopic.includes('health') || lowerTopic.includes('medical') || lowerTopic.includes('wellness')) {
    return 'Health';
  } else if (lowerTopic.includes('sport') || lowerTopic.includes('game') || lowerTopic.includes('athlete')) {
    return 'Sports';
  } else if (lowerTopic.includes('entertain') || lowerTopic.includes('movie') || lowerTopic.includes('music')) {
    return 'Entertainment';
  } else {
    return 'General';
  }
}