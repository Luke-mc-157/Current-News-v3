
// server/routes.ts
import express from "express";
import http from "http";
import { fetchXPosts } from "./services/xSearch.js";
import { generateHeadlines } from "./services/headlineCreator.js";
import { fetchSupportingArticles } from "./services/supportCompiler.js";
import { completeSearch } from "./services/completeSearch.js";
import { setUserTrustedSources, getUserTrustedSources } from "./services/dynamicSources.js";
import { compileContentForPodcast } from "./services/contentFetcher.js";
import { generatePodcastScript, parseScriptSegments } from "./services/podcastGenerator.js";
import { getAvailableVoices, generateAudio, checkQuota } from "./services/voiceSynthesis.js";
import { sendPodcastEmail, isEmailServiceConfigured } from "./services/emailService.js";
import { storage } from "./storage.js";
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
      console.log("Generated headlines by topic:", JSON.stringify(headlinesByTopic, null, 2));
      
      const hasHeadlines = Object.values(headlinesByTopic).some((h) => h.length > 0);
      console.log("Has headlines:", hasHeadlines);
      
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

      console.log(`Final headlines count: ${headlines.length}`);
      if (!headlines.length) {
        console.error("No valid headlines generated - debugging info:");
        console.error("HeadlinesByTopic:", Object.keys(headlinesByTopic));
        console.error("PostsWithData:", Object.keys(postsWithData));
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

  // Load cached headlines for testing (used by podcast test page)
  router.post("/api/load-cached-headlines", (req, res) => {
    const { headlines } = req.body;
    
    if (!Array.isArray(headlines)) {
      return res.status(400).json({ error: "Headlines must be an array" });
    }
    
    headlinesStore = headlines;
    console.log(`Loaded ${headlines.length} cached headlines into backend store for testing`);
    
    res.json({ 
      success: true, 
      message: `Loaded ${headlines.length} cached headlines for testing`,
      headlines: headlinesStore
    });
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

  // Podcast generation routes
  router.post("/api/generate-podcast", async (req, res) => {
    const { durationMinutes = 10, voiceId = 'nPczCjzI2devNBz1zQrb', podcastName = 'Current News' } = req.body;
    
    try {
      if (!headlinesStore.length) {
        return res.status(400).json({ error: "No headlines available. Generate headlines first." });
      }

      // Compile all content for podcast
      const compiledContent = await compileContentForPodcast(headlinesStore);
      
      // Generate podcast script
      const script = await generatePodcastScript(compiledContent, durationMinutes, podcastName);
      
      // Create podcast episode record
      const episode = await storage.createPodcastEpisode({
        userId: 1, // Default user for now
        headlineIds: headlinesStore.map(h => h.id),
        script,
        voiceId,
        durationMinutes
      });
      
      res.json({ 
        success: true, 
        episodeId: episode.id,
        script: script, // Include for "View Script" button
        message: "Podcast script generated successfully"
      });
      
    } catch (error) {
      console.error("Error generating podcast:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get available voices
  router.get("/api/podcast/voices", async (req, res) => {
    try {
      const voices = await getAvailableVoices();
      res.json({ voices });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Generate audio for podcast
  router.post("/api/podcast/:episodeId/generate-audio", async (req, res) => {
    const { episodeId } = req.params;
    
    try {
      const episode = await storage.getPodcastEpisode(parseInt(episodeId));
      if (!episode) {
        return res.status(404).json({ error: "Podcast episode not found" });
      }
      
      // Check ElevenLabs quota
      const quota = await checkQuota();
      if (!quota.available) {
        return res.status(400).json({ error: "ElevenLabs service unavailable: " + quota.message });
      }
      
      // Parse script into segments
      const segments = parseScriptSegments(episode.script);
      
      // Generate audio for each segment
      const audioUrls = [];
      for (let i = 0; i < segments.length; i++) {
        const audioUrl = await generateAudio(segments[i], episode.voiceId, `${episodeId}-${i}`);
        audioUrls.push(audioUrl);
      }
      
      // For now, use the first segment as the main audio
      const mainAudioUrl = audioUrls[0];
      
      // Update episode with audio URL
      await storage.updatePodcastEpisode(parseInt(episodeId), { audioUrl: mainAudioUrl });
      
      console.log(`Audio generation completed for episode ${episodeId}: ${mainAudioUrl}`);
      res.json({ 
        success: true, 
        audioUrl: mainAudioUrl,
        segments: audioUrls.length
      });
      
    } catch (error) {
      console.error("Error generating audio:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Email podcast
  router.post("/api/podcast/:episodeId/email", async (req, res) => {
    const { episodeId } = req.params;
    const { email } = req.body;
    
    try {
      if (!isEmailServiceConfigured()) {
        return res.status(400).json({ error: "Email service not configured. Please set EMAIL_USER and EMAIL_PASS in secrets." });
      }
      
      const episode = await storage.getPodcastEpisode(parseInt(episodeId));
      if (!episode) {
        return res.status(404).json({ error: "Podcast episode not found" });
      }
      
      if (!episode.audioUrl) {
        return res.status(400).json({ error: "Audio not generated yet. Generate audio first." });
      }
      
      // Get headlines for email content
      const headlines = headlinesStore.filter(h => episode.headlineIds.includes(h.id));
      
      const audioPath = path.join(__dirname, '..', episode.audioUrl);
      
      await sendPodcastEmail(email, {
        podcastName: 'Current News',
        headlines,
        durationMinutes: episode.durationMinutes,
        voiceName: episode.voiceId
      }, audioPath);
      
      // Update episode email sent timestamp
      await storage.updatePodcastEpisode(episodeId, { emailSentAt: new Date() });
      
      res.json({ success: true, message: "Podcast sent to " + email });
      
    } catch (error) {
      console.error("Error emailing podcast:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Serve podcast audio files
  app.use('/podcast-audio', express.static(path.join(__dirname, '..', 'podcast-audio')));

  // Serve static podcast audio files
  app.use('/podcast-audio', express.static(path.join(__dirname, '..', 'podcast-audio')));
  
  app.use(router);
  
  return http.createServer(app);
}
