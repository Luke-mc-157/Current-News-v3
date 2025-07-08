import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserTopicsSchema, insertPodcastSettingsSchema } from "@shared/schema";
import { searchXPosts } from "./workflows/x-search";
import { createHeadlinesFromPosts } from "./workflows/headline-creator";
import { findSupportingArticles } from "./workflows/support-compiler";
import { organizeResults } from "./workflows/results-engine";
import { generateSubtopics } from "./workflows/complete-search";
import { log } from "./vite";

export async function registerRoutes(app: Express): Promise<Server> {
  // Generate headlines based on user topics
  app.post(
    "/api/generate-headlines", 
    async (req, res) => {
      try {
        const parsed = insertUserTopicsSchema.parse({
          topics: req.body.topics
        });

        const topics = Array.isArray(parsed.topics) ? parsed.topics : [];

        if (!Array.isArray(topics) || topics.length < 5) {
          return res.status(400).json({ 
            message: "Please provide at least 5 topics to generate headlines." 
          });
        }

        if (!process.env.OPENAI_API_KEY) {
          return res.status(500).json({ 
            message: "OpenAI API key is not configured. Please add OPENAI_API_KEY to environment variables." 
          });
        }

        log(`Starting real news aggregation for topics: ${topics.join(', ')}`);

        try {
          // Workflow 5: Generate subtopics for better coverage
          log("Workflow 5: Generating subtopics...");
          const subtopics = await generateSubtopics(topics as string[]);
          const allTopics = [...topics, ...subtopics];
          log(`Generated ${subtopics.length} subtopics from ${topics.length} main topics`);

          // Workflow 1: Search X posts using X AI API
          log("Workflow 1: Searching X posts...");
          const topicPosts = await searchXPosts(allTopics);
          
          // Workflow 2: Create headlines from posts
          log("Workflow 2: Creating headlines from X posts...");
          const generatedHeadlines = await createHeadlinesFromPosts(topicPosts);
          
          // Workflow 3: Find supporting articles
          log("Workflow 3: Finding supporting articles...");
          const headlinesWithSupport = await findSupportingArticles(generatedHeadlines);
          
          // Workflow 4: Organize and store results
          log("Workflow 4: Organizing results...");
          const organizedHeadlines = organizeResults(headlinesWithSupport);
          
          // Store the headlines
          for (const headline of organizedHeadlines) {
            await storage.createHeadline(headline);
          }

          return res.json({
            message: "Headlines generated successfully",
            count: organizedHeadlines.length
          });

        } catch (error) {
          log(`Error in headline generation: ${error}`);
          return res.status(500).json({ error: "Failed to generate headlines" });
        }

      } catch (error) {
        console.error("Error generating headlines:", error);
        res.status(500).json({ 
          message: "Failed to generate headlines",
          error: error instanceof Error ? error.message : String(error)
        });
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