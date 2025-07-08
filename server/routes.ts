import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserTopicsSchema, insertPodcastSettingsSchema } from "@shared/schema";

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

      // Simulate news aggregation with realistic headlines
      const generatedHeadlines = await generateHeadlinesFromTopics(topics);
      
      // Store headlines in storage
      const savedHeadlines = [];
      for (const headline of generatedHeadlines) {
        const saved = await storage.createHeadline(headline);
        savedHeadlines.push(saved);
      }

      res.json({ headlines: savedHeadlines });
    } catch (error) {
      console.error("Error generating headlines:", error);
      res.status(500).json({ message: "Failed to generate headlines" });
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

async function generateHeadlinesFromTopics(topics: string[]) {
  // This simulates the actual news aggregation process
  // In production, this would scrape X/Twitter and Google News
  
  const categories = ["Technology", "Environment", "Space", "Healthcare", "Finance", "Science", "Politics", "Sports"];
  const engagements = ["High engagement", "Trending", "Viral", "Breaking", "Popular"];
  
  const headlines = [];
  
  for (let i = 0; i < Math.min(15, topics.length * 3); i++) {
    const topic = topics[i % topics.length];
    const category = categories[Math.floor(Math.random() * categories.length)];
    const engagement = engagements[Math.floor(Math.random() * engagements.length)];
    
    const headline = {
      title: generateHeadlineTitle(topic, category),
      summary: generateSummary(topic),
      category,
      engagement,
      sourcePosts: generateSourcePosts(topic),
      supportingArticles: generateSupportingArticles(topic),
    };
    
    headlines.push(headline);
  }
  
  return headlines;
}

function generateHeadlineTitle(topic: string, category: string): string {
  const templates = [
    `Breaking development in ${topic} transforms ${category.toLowerCase()} sector`,
    `Major ${topic} breakthrough announced by leading research institutions`,
    `New ${topic} regulations set to impact global markets significantly`,
    `Industry experts predict ${topic} will revolutionize current practices`,
    `International conference reaches consensus on ${topic} standards`,
    `Government announces new funding for ${topic} initiatives`,
    `Scientists achieve milestone in ${topic} research and development`
  ];
  
  return templates[Math.floor(Math.random() * templates.length)];
}

function generateSummary(topic: string): string {
  const summaries = [
    `Recent developments in ${topic} have shown promising results according to multiple industry reports and expert analysis.`,
    `A comprehensive study reveals significant progress in ${topic} implementation across various sectors and applications.`,
    `Key stakeholders have reached important agreements regarding ${topic} policies and future implementation strategies.`,
    `New research findings demonstrate the potential impact of ${topic} on current industry standards and practices.`,
    `International collaboration has led to breakthrough discoveries in ${topic} with far-reaching implications.`
  ];
  
  return summaries[Math.floor(Math.random() * summaries.length)];
}

function generateSourcePosts(topic: string) {
  const posts = [
    { text: `@TechReporter: "Breaking news on ${topic} development..."`, url: `https://twitter.com/example1` },
    { text: `@NewsUpdate: "Major ${topic} announcement from industry leaders..."`, url: `https://twitter.com/example2` },
    { text: `@ExpertAnalyst: "This ${topic} breakthrough could change everything..."`, url: `https://twitter.com/example3` },
  ];
  
  return posts.slice(0, Math.floor(Math.random() * 3) + 2);
}

function generateSupportingArticles(topic: string) {
  const sources = ["Reuters", "BBC News", "Associated Press", "Financial Times", "Nature.com"];
  const articles = [];
  
  for (let i = 0; i < Math.floor(Math.random() * 3) + 2; i++) {
    const source = sources[Math.floor(Math.random() * sources.length)];
    articles.push({
      title: `${source} - ${topic.charAt(0).toUpperCase() + topic.slice(1)} Development Report`,
      url: `https://news.example.com/${topic.replace(/\s+/g, '-').toLowerCase()}`
    });
  }
  
  return articles;
}
