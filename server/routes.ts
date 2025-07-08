import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserTopicsSchema, insertPodcastSettingsSchema } from "@shared/schema";
import { searchTwitterPosts } from "./workflows/x-search";
import { createHeadlinesFromPosts } from "./workflows/headline-creator";
import { findSupportingArticles } from "./workflows/support-compiler";
import { organizeResults } from "./workflows/results-engine";
import { generateSubtopics } from "./workflows/complete-search";
import { log } from "./vite";

export async function registerRoutes(app: Express): Promise<Server> {
  // Generate headlines based on topics
  app.post("/api/generate-headlines", async (req, res) => {
    try {
      const { topics } = req.body;
      
      if (!topics || !Array.isArray(topics) || topics.length < 5) {
        return res.status(400).json({ 
          message: "At least 5 topics are required" 
        });
      }

      // Check for required API keys
      if (!process.env.OPENAI_API_KEY) {
        return res.status(500).json({ 
          message: "OpenAI API key is required. Please provide OPENAI_API_KEY." 
        });
      }

      if (!process.env.SCRAPINGBEE_API_KEY) {
        return res.status(500).json({ 
          message: "ScrapingBee API key is required. Please provide SCRAPINGBEE_API_KEY." 
        });
      }

      log(`Starting real news aggregation for topics: ${topics.join(', ')}`);

      try {
        // Workflow 5: Generate subtopics for better coverage
        log("Workflow 5: Generating subtopics...");
        const subtopics = await generateSubtopics(topics);
        const allTopics = [...topics, ...subtopics];
        log(`Generated ${subtopics.length} subtopics from ${topics.length} main topics`);

        // Since we don't have Twitter Bearer Token, we'll use an alternative approach
        // We'll use web search to find recent news about the topics
        const headlines = [];

        for (const topic of allTopics.slice(0, 15)) { // Limit to 15 for performance
          try {
            // Use OpenAI to generate factual headlines based on the topic
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                model: 'gpt-4',
                messages: [
                  {
                    role: 'system',
                    content: 'You are a news headline generator. Generate ONLY factual, declarative headlines without adjectives or opinions. Base headlines on real recent events if you know of any, otherwise indicate that real-time data is needed.'
                  },
                  {
                    role: 'user',
                    content: `Generate a factual news headline about "${topic}" based on recent events. If you don't have access to real-time data, prefix with "Real-time data needed:"`
                  }
                ],
                temperature: 0.3,
                max_tokens: 100
              })
            });

            if (!response.ok) {
              throw new Error(`OpenAI API error: ${response.statusText}`);
            }

            const data = await response.json();
            const generatedHeadline = data.choices[0].message.content.trim();

            // Use ScrapingBee to find supporting articles
            const searchQuery = encodeURIComponent(topic);
            const googleNewsUrl = `https://news.google.com/search?q=${searchQuery}&hl=en-US&gl=US&ceid=US:en`;
            
            const scrapingBeeUrl = `https://app.scrapingbee.com/api/v1/?api_key=${process.env.SCRAPINGBEE_API_KEY}&url=${encodeURIComponent(googleNewsUrl)}&render_js=true&wait=3000`;

            const scrapingResponse = await fetch(scrapingBeeUrl);
            const supportingArticles = [];

            if (scrapingResponse.ok) {
              // Parse for real article links
              const html = await scrapingResponse.text();
              const urlPattern = /href="\.\/articles\/([^"]+)"/g;
              const matches = [];
              let match;
              while ((match = urlPattern.exec(html)) !== null) {
                matches.push(match);
              }
              
              for (let i = 0; i < Math.min(3, matches.length); i++) {
                supportingArticles.push({
                  title: `Google News: Article about ${topic}`,
                  url: `https://news.google.com/articles/${matches[i][1]}`
                });
              }
            }

            // If no articles found, add search links
            if (supportingArticles.length === 0) {
              supportingArticles.push(
                { title: `Search Reuters for ${topic}`, url: `https://www.reuters.com/search/news?blob=${searchQuery}` },
                { title: `Search BBC News for ${topic}`, url: `https://www.bbc.com/search?q=${searchQuery}` },
                { title: `Search AP News for ${topic}`, url: `https://apnews.com/search?q=${searchQuery}` }
              );
            }

            headlines.push({
              title: generatedHeadline,
              summary: `Real-time news aggregation for ${topic}. Note: Without Twitter API access, headlines are generated based on topic relevance. Supporting articles provide current news sources.`,
              category: determineCategory(topic),
              engagement: "Pending real-time data",
              sourcePosts: [
                { text: "Twitter API access required for real posts", url: "https://developer.twitter.com/en/docs/twitter-api" }
              ],
              supportingArticles
            });

          } catch (error) {
            log(`Error processing topic "${topic}": ${error}`);
          }
        }

        // Store headlines in storage
        const savedHeadlines = [];
        for (const headline of headlines) {
          const saved = await storage.createHeadline(headline);
          savedHeadlines.push(saved);
        }

        res.json({ headlines: savedHeadlines });

      } catch (workflowError) {
        log(`Workflow error: ${workflowError}`);
        
        // If workflows fail, return error with details
        return res.status(500).json({ 
          message: "Failed to aggregate real news data. Ensure all API keys are provided and valid.",
          error: workflowError instanceof Error ? workflowError.message : String(workflowError)
        });
      }

    } catch (error) {
      console.error("Error generating headlines:", error);
      res.status(500).json({ 
        message: "Failed to generate headlines",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

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
      const validatedSettings = insertPodcastSettingsSchema.parse(req.body);
      const settings = await storage.createPodcastSettings(validatedSettings);
      res.json({ settings });
    } catch (error) {
      console.error("Error saving podcast settings:", error);
      res.status(500).json({ message: "Failed to save podcast settings" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

function determineCategory(topic: string): string {
  const topicLower = topic.toLowerCase();
  
  if (topicLower.includes('tech') || topicLower.includes('ai') || topicLower.includes('software') || topicLower.includes('crypto')) {
    return 'Technology';
  } else if (topicLower.includes('climate') || topicLower.includes('environment') || topicLower.includes('sustain')) {
    return 'Environment';
  } else if (topicLower.includes('space') || topicLower.includes('nasa') || topicLower.includes('astro')) {
    return 'Space';
  } else if (topicLower.includes('health') || topicLower.includes('medical') || topicLower.includes('covid')) {
    return 'Healthcare';
  } else if (topicLower.includes('finance') || topicLower.includes('economy') || topicLower.includes('market')) {
    return 'Finance';
  } else if (topicLower.includes('science') || topicLower.includes('research') || topicLower.includes('study')) {
    return 'Science';
  } else if (topicLower.includes('politic') || topicLower.includes('government') || topicLower.includes('election')) {
    return 'Politics';
  } else if (topicLower.includes('sport') || topicLower.includes('game') || topicLower.includes('team')) {
    return 'Sports';
  }
  
  return 'General';
}
