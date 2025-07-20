import { Request, Response, Router } from "express";
import { storage } from "../storage";
import { insertUserRssFeedsSchema } from "@shared/schema";
import { validateRssFeed } from "../services/rssService.js";

const router = Router();

// Get user's RSS feeds
router.get("/api/rss-feeds/:userId", async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    
    if (isNaN(userId)) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    const feeds = await storage.getUserRssFeeds(userId);
    res.json(feeds);
  } catch (error) {
    console.error("Error fetching RSS feeds:", error);
    res.status(500).json({ error: "Failed to fetch RSS feeds" });
  }
});

// Add new RSS feed
router.post("/api/rss-feeds", async (req: Request, res: Response) => {
  try {
    const validatedData = insertUserRssFeedsSchema.parse(req.body);
    
    // Validate RSS feed URL
    const validation = await validateRssFeed(validatedData.feedUrl);
    
    if (!validation.valid) {
      return res.status(400).json({ 
        error: "Invalid RSS feed", 
        details: validation.error 
      });
    }

    // Use detected feed title if no name provided
    const feedData = {
      ...validatedData,
      feedName: validatedData.feedName || validation.title || "Unnamed Feed"
    };

    const newFeed = await storage.createUserRssFeed(feedData);
    
    // Update last fetched timestamp
    await storage.updateUserRssFeed(newFeed.id, { 
      lastFetched: new Date() 
    });

    res.json(newFeed);
  } catch (error) {
    console.error("Error adding RSS feed:", error);
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Invalid feed data", details: error.errors });
    }
    res.status(500).json({ error: "Failed to add RSS feed" });
  }
});

// Update RSS feed
router.put("/api/rss-feeds/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid feed ID" });
    }

    const updates = req.body;
    
    // If URL is being updated, validate it
    if (updates.feedUrl) {
      const validation = await validateRssFeed(updates.feedUrl);
      if (!validation.valid) {
        return res.status(400).json({ 
          error: "Invalid RSS feed", 
          details: validation.error 
        });
      }
    }

    const updatedFeed = await storage.updateUserRssFeed(id, updates);
    
    if (!updatedFeed) {
      return res.status(404).json({ error: "RSS feed not found" });
    }

    res.json(updatedFeed);
  } catch (error) {
    console.error("Error updating RSS feed:", error);
    res.status(500).json({ error: "Failed to update RSS feed" });
  }
});

// Delete RSS feed
router.delete("/api/rss-feeds/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid feed ID" });
    }

    await storage.deleteUserRssFeed(id);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting RSS feed:", error);
    res.status(500).json({ error: "Failed to delete RSS feed" });
  }
});

// Validate RSS feed URL (utility endpoint)
router.post("/api/rss-feeds/validate", async (req: Request, res: Response) => {
  try {
    const { feedUrl } = req.body;
    
    if (!feedUrl) {
      return res.status(400).json({ error: "Feed URL is required" });
    }

    const validation = await validateRssFeed(feedUrl);
    res.json(validation);
  } catch (error) {
    console.error("Error validating RSS feed:", error);
    res.status(500).json({ error: "Failed to validate RSS feed" });
  }
});

export default router;