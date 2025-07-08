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
          // Workflow 1: X Search - Search topics on X
          log("=== WORKFLOW 1: X SEARCH ===");
          log("Searching for posts on X for initial topics...");
          const initialTopicPosts = await searchXPosts(topics as string[]);
          log(`Workflow 1 Complete: Found posts for ${initialTopicPosts.length} topics with ${initialTopicPosts.reduce((sum, tp) => sum + tp.posts.length, 0)} total posts`);

          // Workflow 2: Headline Creator - Create headlines from X posts
          log("=== WORKFLOW 2: HEADLINE CREATOR ===");
          log("Creating declarative headlines from X posts...");
          const initialHeadlines = await createHeadlinesFromPosts(initialTopicPosts);
          log(`Workflow 2 Complete: Generated ${initialHeadlines.length} headlines`);

          // Workflow 3: Support Compiler - Find supporting articles
          log("=== WORKFLOW 3: SUPPORT COMPILER ===");
          log("Searching Google News for supporting articles...");
          const initialHeadlinesWithSupport = await findSupportingArticles(initialHeadlines);
          log(`Workflow 3 Complete: Found supporting articles for ${initialHeadlinesWithSupport.length} headlines`);

          // Workflow 4: Results Engine - Organize results by engagement
          log("=== WORKFLOW 4: RESULTS ENGINE ===");
          log("Organizing results by X post engagement...");
          const initialResults = organizeResults(initialHeadlinesWithSupport);
          log(`Workflow 4 Complete: Organized ${initialResults.length} results`);

          // Workflow 5: Complete Search - Generate subtopics and repeat process
          log("=== WORKFLOW 5: COMPLETE SEARCH ===");
          log("Generating subtopics for comprehensive coverage...");
          const subtopics = await generateSubtopics(topics as string[]);
          log(`Generated ${subtopics.length} subtopics (2 per topic)`);

          // Repeat Workflows 1-4 for subtopics
          log("Repeating X Search for subtopics...");
          const subtopicPosts = await searchXPosts(subtopics);
          log(`Found posts for ${subtopicPosts.length} subtopics`);
          
          log("Creating headlines from subtopic posts...");
          const subtopicHeadlines = await createHeadlinesFromPosts(subtopicPosts);
          
          log("Finding supporting articles for subtopic headlines...");
          const subtopicHeadlinesWithSupport = await findSupportingArticles(subtopicHeadlines);
          
          log("Organizing subtopic results...");
          const subtopicResults = organizeResults(subtopicHeadlinesWithSupport);
          
          // Combine all results and ensure we have at least 15
          const allResults = [...initialResults, ...subtopicResults];
          log(`=== ALL WORKFLOWS COMPLETE ===`);
          log(`Total headlines generated: ${allResults.length}`);
          
          if (allResults.length < 15) {
            log(`Warning: Only ${allResults.length} headlines generated (target: 15+)`);
          }
          
          // Store all headlines
          for (const headline of allResults) {
            await storage.createHeadline(headline);
          }

          return res.json({
            message: "Headlines generated successfully",
            count: allResults.length,
            workflowsCompleted: 5
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