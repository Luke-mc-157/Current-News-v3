
// server/routes.ts
import express from "express";
import http from "http";
// Old workflow imports removed - using only xAI Live Search

import { compileContentForPodcast } from "./services/contentFetcher.js";
import axios from 'axios';
import { generatePodcastScript, parseScriptSegments } from "./services/podcastGenerator.js";
import { getAvailableVoices, generateAudio, checkQuota, combineAudioSegments } from "./services/voiceSynthesis.js";
import { sendPodcastEmail, isEmailServiceConfigured } from "./services/emailService.js";
import { storage } from "./storage.js";
import { generateHeadlinesWithLiveSearch } from "./services/liveSearchService.js";
import { getXLoginUrl, handleXCallback, isXAuthConfigured, getXAuthStatus, validateXAuthEnvironment } from "./services/xAuth.js";
import { fetchUserTimeline } from "./services/xTimeline.js";
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function registerRoutes(app) {
  const router = express.Router();
  let headlinesStore = [];
  let appendixStore = null;
  let compiledDataStore = null; // Store raw compiled data for podcast generation

  // Old workflow endpoint removed - using only xAI Live Search

  // Main endpoint: Generate headlines using xAI Live Search
  router.post("/api/generate-headlines", async (req, res) => {
    const { topics } = req.body;
    if (!topics || topics.length < 1) {
      return res.status(400).json({ message: "At least 1 topic required" });
    }

    try {
      console.log("🚀 Using xAI Live Search for headlines generation");
      const startTime = Date.now();
      
      // Check if user has authenticated with X (use session if available)
      const userId = req.session?.userId || 1; // Get from session or default to 1
      const authToken = await storage.getXAuthTokenByUserId(userId);
      
      let userHandle = null;
      let accessToken = null;
      
      if (authToken) {
        // Create authenticated client with token refresh capability
        const { createAuthenticatedClient } = await import('./services/xAuth.js');
        const authClientResult = await createAuthenticatedClient(
          authToken.accessToken,
          authToken.refreshToken,
          authToken.expiresAt
        );
        
        // If tokens were refreshed, update the database
        if (authClientResult.updatedTokens) {
          await storage.updateXAuthToken(userId, authClientResult.updatedTokens);
          console.log(`🔄 Refreshed and updated tokens for user ${userId}`);
        }
        
        userHandle = authToken.xHandle;
        accessToken = authClientResult.updatedTokens?.accessToken || authToken.accessToken;
        console.log(`📱 User ${userHandle} authenticated - will include timeline posts`);
      }
      
      // Use Live Search to generate headlines with optional timeline posts
      const result = await generateHeadlinesWithLiveSearch(topics, userId, userHandle, accessToken);
      const { headlines, appendix } = result;
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      // Store headlines, appendix, and compiled data for podcast generation
      headlinesStore = headlines;
      appendixStore = appendix;
      compiledDataStore = result.compiledData;
      
      console.log(`✅ Live Search completed in ${responseTime}ms with ${headlines.length} headlines`);
      console.log(`📊 Performance improvement: ${Math.round(30000 / responseTime)}x faster than old system`);
      
      res.json({ 
        success: true, 
        headlines,
        performance: {
          responseTime: `${responseTime}ms`,
          method: "xAI Live Search",
          apiCalls: 1
        }
      });
    } catch (error) {
      console.error("Error in /api/generate-headlines:", error.message);
      res.status(500).json({ 
        message: "Live Search failed: " + error.message
      });
    }
  });

  // Old X API + OpenAI workflow endpoint removed

  // Test endpoint to see raw xAI Live Search responses
  router.post("/api/test-raw-xai", async (req, res) => {
    const { topics } = req.body;
    if (!topics || topics.length < 1) {
      return res.status(400).json({ message: "At least 1 topic required" });
    }

    try {
      console.log('🧪 Testing raw xAI Live Search responses');
      
      // Import OpenAI client
      const OpenAI = (await import('openai')).default;
      const client = new OpenAI({
        baseURL: "https://api.x.ai/v1",
        apiKey: process.env.XAI_API_KEY,
      });
      
      const rawResponses = [];
      
      // Test just the first topic for faster response
      const topic = topics[0];
      console.log(`🔍 Testing raw xAI response for: ${topic}`);
      
      try {
        const response = await Promise.race([
          client.chat.completions.create({
            model: "grok-4",
            messages: [
              {
                role: "user",
                content: `Get latest news about ${topic} from from the last 24 hours. Include source URLs in your citations.`
              }
            ],
            search_parameters: {
              mode: "on",
              max_search_results: 15,
              return_citations: true
            },
            max_tokens: 2000
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Request timeout')), 30000)
          )
        ]);
        
        const content = response.choices[0].message.content;
        const citations = response.citations || [];
        
        console.log(`📄 Raw response received: ${content.length} chars, ${citations.length} citations`);
        
        rawResponses.push({
          topic: topic,
          content: content,
          citations: citations,
          contentLength: content.length,
          citationCount: citations.length,
          citationPreview: citations.slice(0, 5), // Show first 5 citations
          contentPreview: content.substring(0, 1000) + (content.length > 1000 ? '...' : ''),
          fullResponse: {
            content: content,
            citations: citations,
            responseMetadata: {
              model: response.model,
              usage: response.usage
            }
          }
        });
        
      } catch (error) {
        console.error(`❌ Error for topic ${topic}:`, error.message);
        rawResponses.push({
          topic: topic,
          error: error.message,
          content: '',
          citations: []
        });
      }
      
      res.json({ 
        success: true, 
        rawResponses: rawResponses,
        totalTopics: rawResponses.length,
        message: `Retrieved raw xAI response for ${topic}`,
        note: "This is the raw response before any processing in the livesearch workflow"
      });
      
    } catch (error) {
      console.error('❌ Error testing raw xAI:', error.message);
      res.status(500).json({ message: error.message });
    }
  });

  router.get("/api/headlines", (req, res) => {
    if (!headlinesStore.length) {
      return res.status(404).json({ headlines: [], message: "No headlines available" });
    }
    res.json({ headlines: headlinesStore.sort((a, b) => b.engagement - a.engagement) });
  });

  // Debug endpoint to test axios/cheerio article scraping
  router.post("/api/debug/scrape-article", async (req, res) => {
    console.log("🔍 Scraper endpoint called with:", req.body);
    
    const { url } = req.body;
    
    if (!url) {
      console.log("❌ No URL provided");
      return res.status(400).json({ error: "URL is required" });
    }

    try {
      console.log(`🔍 Testing article scraping for: ${url}`);
      
      // Test metadata extraction (same as extractArticleData in liveSearchService)
      const metadataResult = await extractArticleMetadata(url);
      console.log("✅ Metadata extracted:", metadataResult);
      
      // Test body content extraction (same as fetchArticleContent in contentFetcher)
      const bodyResult = await extractArticleBody(url);
      console.log("✅ Body content extracted:", bodyResult ? `${bodyResult.length} chars` : "null");
      
      const response = {
        url: url,
        metadata: metadataResult,
        body: {
          content: bodyResult,
          length: bodyResult ? bodyResult.length : 0,
          preview: bodyResult ? bodyResult.substring(0, 500) + "..." : null
        }
      };
      
      console.log("✅ Sending response:", JSON.stringify(response, null, 2));
      res.json(response);
      
    } catch (error) {
      console.error("❌ Error testing article scraping:", error);
      res.status(500).json({ error: error.message });
    }
  });

  async function extractArticleMetadata(url) {
    try {
      const response = await axios.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NewsBot/1.0)' },
        timeout: 8000
      });
      
      const { load } = await import('cheerio');
      const $ = load(response.data);
      
      return {
        title: $('title').text() || $('meta[property="og:title"]').attr('content') || `[Article from ${new URL(url).hostname}]`,
        ogTitle: $('meta[property="og:title"]').attr('content'),
        ogDescription: $('meta[property="og:description"]').attr('content'),
        metaDescription: $('meta[name="description"]').attr('content'),
        source: new URL(url).hostname,
        responseSize: response.data.length
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  async function extractArticleBody(url) {
    try {
      const response = await fetch(url);
      const html = await response.text();
      
      // Basic content extraction - remove scripts, styles, etc.
      const textContent = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      return textContent.substring(0, 15000); // Return first 15000 chars for testing
    } catch (error) {
      return null;
    }
  }

  // Quick endpoint to check post count
  router.get("/api/posts/count", async (_req, res) => {
    try {
      const posts = await storage.getUserTimelinePosts(1); // Check user 1's posts
      res.json({ count: posts.length, success: true });
    } catch (error) {
      res.status(500).json({ error: error.message, success: false });
    }
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



  // Podcast generation routes
  router.post("/api/generate-podcast", async (req, res) => {
    const { durationMinutes = 10, voiceId = 'nPczCjzI2devNBz1zQrb', podcastName = 'Current News' } = req.body;
    
    try {
      if (!headlinesStore.length) {
        return res.status(400).json({ error: "No headlines available. Generate headlines first." });
      }

      // Use raw compiled data if available, otherwise fall back to processed content
      let script;
      if (compiledDataStore) {
        console.log(`📄 Using raw compiled data for podcast generation (${compiledDataStore.length} chars)`);
        script = await generatePodcastScript(compiledDataStore, appendixStore, durationMinutes, podcastName);
      } else {
        console.log(`📄 Using processed content for podcast generation (legacy mode)`);
        const compiledContent = await compileContentForPodcast(headlinesStore);
        script = await generatePodcastScript(compiledContent, appendixStore, durationMinutes, podcastName);
      }
      
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
        console.log(`📻 Generated segment ${i + 1}/${segments.length}: ${audioUrl}`);
      }
      
      // Combine all segments into a single audio file
      console.log(`🔄 Combining ${audioUrls.length} segments into final podcast...`);
      const mainAudioUrl = await combineAudioSegments(audioUrls, episodeId);
      
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
        const { getEmailServiceStatus } = await import('./services/emailService.js');
        const status = getEmailServiceStatus();
        console.log('Email service status:', status);
        return res.status(400).json({ 
          error: "Email service not configured. Please add EMAIL_USER and EMAIL_PASS to your Replit secrets.",
          details: `Missing: ${!status.hasUser ? 'EMAIL_USER ' : ''}${!status.hasPassword ? 'EMAIL_PASS' : ''}`
        });
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

  // X OAuth authentication routes
  let userAuthData = { 
    authenticated: false,
    accessToken: null,
    refreshToken: null,
    timestamp: null,
    xHandle: null
  }; // In-memory storage for demo (use database in production)
  
  // X Auth status endpoint
  router.get("/api/auth/x/status", async (req, res) => {
    try {
      const status = getXAuthStatus();
      
      // Check session and database for persistent authentication
      const userId = req.session?.userId || 1;
      let authToken = null;
      
      try {
        authToken = await storage.getXAuthTokenByUserId(userId);
      } catch (dbError) {
        console.log('Database check failed:', dbError.message);
      }
      
      const isAuthenticated = !!(authToken && authToken.accessToken);
      
      res.json({
        ...status,
        authenticated: isAuthenticated,
        accessToken: authToken?.accessToken ? 'present' : null,
        xHandle: authToken?.xHandle || req.session?.xHandle,
        persistent: !!req.session?.xAuthenticated,
        expiresAt: authToken?.expiresAt,
        success: true
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // X Auth configuration debug endpoint
  router.get("/api/auth/x/debug", (req, res) => {
    try {
      const status = getXAuthStatus();
      const websiteUrl = status.callbackUrl.replace('/auth/twitter/callback', '');
      
      res.json({
        configured: status.configured,
        currentUrls: {
          websiteUrl,
          callbackUrl: status.callbackUrl
        },
        xDeveloperPortalInstructions: {
          step1: 'Go to X Developer Portal: https://developer.x.com/en/portal/dashboard',
          step2: 'Navigate to: Projects & Apps → Your App → Settings',
          step3: 'Under "Authentication Settings", add these EXACT URLs:',
          websiteUrl: `Website URL: ${websiteUrl}`,
          callbackUrl: `Callback URL: ${status.callbackUrl}`,
          step4: 'Save changes and test authentication',
          note: 'URLs must be exact matches (case-sensitive, no trailing slashes)'
        }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Generate X login URL
  router.post("/api/auth/x/login", async (req, res) => {
    try {
      // Enhanced validation before attempting to generate URL
      const validation = validateXAuthEnvironment();
      if (!validation.valid) {
        console.error('❌ X OAuth environment validation failed:', validation.issues);
        return res.status(400).json({
          error: 'OAuth configuration invalid',
          issues: validation.issues,
          config: validation.config,
          success: false
        });
      }
      
      const state = 'state-' + Date.now() + '-' + Math.random().toString(36).substring(2);
      const authLink = getXLoginUrl(state);
      
      // Extract the URL from the auth link object
      const loginUrl = authLink.url;
      
      console.log('✅ Generated auth URL with scopes:', authLink.scope);
      console.log('- State:', state);
      console.log('- URL length:', loginUrl.length);
      
      res.json({ 
        loginUrl, 
        state,
        success: true,
        validation: validation
      });
    } catch (error) {
      console.error("❌ Error generating X login URL:", error);
      res.status(500).json({ 
        error: error.message,
        success: false
      });
    }
  });
  
  // Fetch and store user's X data (timeline working, follows needs Project attachment)
  router.post("/api/x/fetch-user-data", async (req, res) => {
    try {
      const userId = 1; // In production, get from session/JWT
      
      // Get user's X auth token (use session if available)
      const sessionUserId = req.session?.userId || userId;
      const authToken = await storage.getXAuthTokenByUserId(sessionUserId);
      if (!authToken) {
        return res.status(401).json({ 
          error: "User not authenticated with X. Please login with X first." 
        });
      }

      // Import X timeline service for timeline endpoint
      const { fetchUserTimeline, storeUserData } = await import('./services/xTimeline.js');
      
      // Get X user ID from token with refresh capability
      const { createAuthenticatedClient } = await import('./services/xAuth.js');
      const authClientResult = await createAuthenticatedClient(
        authToken.accessToken,
        authToken.refreshToken,
        authToken.expiresAt
      );
      const client = authClientResult.client;
      
      // If tokens were refreshed, update the database
      if (authClientResult.updatedTokens) {
        await storage.updateXAuthToken(sessionUserId, authClientResult.updatedTokens);
        console.log(`🔄 Refreshed and updated tokens for user ${sessionUserId}`);
      }
      
      const { data: xUser } = await client.v2.me();
      
      console.log(`Fetching X data for user: ${xUser.username} (${xUser.id})`);

      // Focus only on timeline endpoint as requested
      let follows = []; // Empty since we're not fetching follows
      let timelinePosts = [];
      const results = {};

      // Only fetch timeline using the reverse chronological endpoint
      try {
        console.log('Calling fetchUserTimeline with:', {
          userId: xUser.id,
          handle: xUser.username,
          accessToken: authToken.accessToken.substring(0, 20) + '...'
        });
        
        timelinePosts = await fetchUserTimeline(authToken.accessToken, xUser.id, 7);
        results.timeline = { success: true, count: timelinePosts.length };
        console.log(`Successfully fetched ${timelinePosts.length} timeline posts`);
      } catch (error) {
        console.log('Timeline endpoint failed:', error.message);
        results.timeline = { success: false, error: error.message };
      }

      // Store whatever data we got
      const storeResult = await storeUserData(storage, userId, follows, timelinePosts);

      const hasAnyData = follows.length > 0 || timelinePosts.length > 0;

      res.json({
        success: hasAnyData,
        xUserId: xUser.id,
        xHandle: xUser.username,
        ...storeResult,
        endpoints: results,
        message: hasAnyData 
          ? `Successfully fetched ${timelinePosts.length} posts from reverse chronological home timeline`
          : "Failed to fetch timeline data",
        status: {
          timelineWorking: results.timeline.success,
          endpoint: "/2/users/:id/timelines/reverse_chronological",
          newApp: "Current News Application v3"
        },
        timelineData: hasAnyData ? {
          totalPosts: timelinePosts.length,
          samplePost: timelinePosts[0] ? {
            author: timelinePosts[0].authorHandle,
            text: timelinePosts[0].text.substring(0, 50) + '...',
            likes: timelinePosts[0].likeCount
          } : null
        } : null
      });

    } catch (error) {
      console.error("Error fetching X user data:", error);
      res.status(500).json({ 
        error: error.message || "Failed to fetch X user data" 
      });
    }
  });

  // Get stored user follows
  router.get("/api/x/follows", async (req, res) => {
    try {
      const userId = 1; // In production, get from session/JWT
      const follows = await storage.getUserFollows(userId);
      
      res.json({
        success: true,
        follows,
        count: follows.length
      });
    } catch (error) {
      console.error("Error getting user follows:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get stored user timeline posts
  router.get("/api/x/timeline", async (req, res) => {
    try {
      const userId = 1; // In production, get from session/JWT
      const days = parseInt(req.query.days) || 7;
      const posts = await storage.getUserTimelinePosts(userId, days);
      
      res.json({
        success: true,
        posts,
        count: posts.length,
        days
      });
    } catch (error) {
      console.error("Error getting user timeline:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Quick test endpoint to verify Project attachment fix
  router.post("/api/x/test-project-attachment", async (req, res) => {
    try {
      const userId = 1;
      
      // Get user's X auth token
      const authToken = await storage.getXAuthTokenByUserId(userId);
      if (!authToken) {
        return res.status(401).json({ 
          error: "User not authenticated with X. Please login with X first.",
          needsAuth: true
        });
      }

      // Test the exact endpoints that were failing
      const { createAuthenticatedClient } = await import('./services/xAuth.js');
      const client = createAuthenticatedClient(authToken.accessToken);
      
      // Get current user info
      const { data: xUser } = await client.v2.me();
      
      console.log(`Testing Project attachment for: ${xUser.username} (${xUser.id})`);

      // Test both endpoints quickly
      const results = {};
      
      try {
        const following = await client.v2.following(xUser.id, { max_results: 5 });
        results.following = {
          success: true,
          count: following.data?.length || 0,
          message: "Following endpoint working!"
        };
      } catch (error) {
        results.following = {
          success: false,
          error: error.data?.reason || error.message,
          needsProjectAttachment: error.data?.reason === 'client-not-enrolled'
        };
      }
      
      try {
        const timeline = await client.v2.userTimeline(xUser.id, { max_results: 5 });
        results.timeline = {
          success: true,
          count: timeline.data?.length || 0,
          message: "Timeline endpoint working!"
        };
      } catch (error) {
        results.timeline = {
          success: false,
          error: error.data?.reason || error.message,
          needsProjectAttachment: error.data?.reason === 'client-not-enrolled'
        };
      }

      const allWorking = results.following.success && results.timeline.success;

      res.json({
        success: allWorking,
        xUser: { id: xUser.id, username: xUser.username },
        endpoints: results,
        message: allWorking 
          ? "Project attachment successful! All endpoints working!"
          : "Project attachment still needed. Complete steps in X Developer Portal.",
        nextStep: allWorking 
          ? "Run full data fetch: POST /api/x/fetch-user-data"
          : "Attach App 31188075 to a Project in https://developer.twitter.com/en/portal/dashboard"
      });

    } catch (error) {
      console.error("Error testing Project attachment:", error);
      res.status(500).json({ 
        error: error.message,
        message: "Authentication or Project attachment issue"
      });
    }
  });

  // X OAuth callback endpoint
  router.get("/auth/twitter/callback", async (req, res) => {
    const { code, state, error, error_description } = req.query;
    
    console.log('📥 OAuth callback received:');
    console.log('- Code present:', !!code);
    console.log('- State present:', !!state);
    console.log('- Error present:', !!error);
    console.log('- Full query params:', req.query);
    console.log('- Request URL:', req.url);
    console.log('- Request headers:', req.headers);
    
    // Handle X OAuth errors (user denied, etc.)
    if (error) {
      console.error('❌ X OAuth returned error:', error);
      console.error('Error description:', error_description);
      
      const errorMessage = error === 'access_denied' 
        ? 'User denied access to the application'
        : `OAuth error: ${error} - ${error_description}`;
      
      return res.status(400).send(`
        <html>
          <head>
            <title>X Authentication Error</title>
            <style>
              body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                margin: 0;
                background: #f3f4f6;
              }
              .container {
                text-align: center;
                padding: 2rem;
                background: white;
                border-radius: 12px;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                max-width: 400px;
              }
              .error {
                color: #dc2626;
                font-size: 1.2rem;
                margin-bottom: 1rem;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="error">✗ Authentication Error</div>
              <p>${errorMessage}</p>
              <p>Please close this window and try again.</p>
            </div>
          </body>
        </html>
      `);
    }
    
    // Validate required parameters
    if (!code || !state) {
      console.error('❌ Missing required OAuth parameters');
      return res.status(400).send(`
        <html>
          <head>
            <title>X Authentication Error</title>
            <style>
              body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                margin: 0;
                background: #f3f4f6;
              }
              .container {
                text-align: center;
                padding: 2rem;
                background: white;
                border-radius: 12px;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                max-width: 400px;
              }
              .error {
                color: #dc2626;
                font-size: 1.2rem;
                margin-bottom: 1rem;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="error">✗ Invalid OAuth Response</div>
              <p>Missing required authentication parameters. This may indicate a callback URL mismatch.</p>
              <p>Please close this window and try again.</p>
            </div>
          </body>
        </html>
      `);
    }
    
    try {
      const authResult = await handleXCallback(code, state);
      
      if (!authResult || !authResult.success) {
        throw new Error('Token exchange failed');
      }
      
      // Get authenticated X user info using the token
      const { createAuthenticatedClient } = await import('./services/xAuth.js');
      const authClientResult = await createAuthenticatedClient(
        authResult.accessToken,
        authResult.refreshToken,
        authResult.expiresAt
      );
      const client = authClientResult.client;
      
      if (!client) {
        throw new Error('Failed to create authenticated client');
      }
      
      let user;
      try {
        const userResponse = await client.v2.me();
        user = userResponse.data;
      } catch (meError) {
        console.error('Error calling client.v2.me():', meError);
        throw new Error('Failed to fetch user info with access token');
      }
      
      // Store in database (for now use userId 1 as default)
      const userId = 1; // In production, get from session/JWT
      
      // Calculate expires timestamp properly
      const expiresAt = new Date(authResult.expiresAt).getTime();
      
      // Check if token already exists for this user
      const existingToken = await storage.getXAuthTokenByUserId(userId);
      
      if (existingToken) {
        // Update existing token
        await storage.updateXAuthToken(userId, {
          xUserId: user.id,
          xHandle: user.username,
          accessToken: authResult.accessToken,
          refreshToken: authResult.refreshToken,
          expiresIn: authResult.expiresIn,
          expiresAt: expiresAt
        });
        console.log(`🔄 Updated existing tokens for user ${userId}`);
      } else {
        // Create new token
        await storage.createXAuthToken({
          userId,
          xUserId: user.id,
          xHandle: user.username,
          accessToken: authResult.accessToken,
          refreshToken: authResult.refreshToken,
          expiresIn: authResult.expiresIn,
          expiresAt: expiresAt
        });
        console.log(`🆕 Created new tokens for user ${userId}`);
      }
      
      // Set user session for persistence
      req.session.userId = userId;
      req.session.xAuthenticated = true;
      req.session.xHandle = user.username;
      
      console.log(`💾 Session established for user ${user.username}`);
      
      // Store auth data temporarily for immediate use
      userAuthData.accessToken = authResult.accessToken;
      userAuthData.refreshToken = authResult.refreshToken;
      userAuthData.authenticated = true;
      userAuthData.timestamp = Date.now();
      userAuthData.xHandle = user.username;
      
      console.log('X Authentication successful:', {
        xHandle: user.username,
        authenticated: userAuthData.authenticated,
        timestamp: userAuthData.timestamp
      });
      
      // Return success page that closes popup
      res.send(`
        <html>
          <head>
            <title>X Authentication Successful</title>
            <style>
              body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                margin: 0;
                background: #f3f4f6;
              }
              .container {
                text-align: center;
                padding: 2rem;
                background: white;
                border-radius: 12px;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                max-width: 400px;
              }
              .success {
                color: #059669;
                font-size: 1.2rem;
                margin-bottom: 1rem;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="success">✓ Authentication Successful!</div>
              <p>You can close this window and return to the application.</p>
              <script>
                // Auto-close popup after 3 seconds
                setTimeout(() => {
                  window.close();
                }, 3000);
              </script>
            </div>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("X OAuth callback error:", error);
      res.status(400).send(`
        <html>
          <head>
            <title>X Authentication Failed</title>
            <style>
              body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                margin: 0;
                background: #f3f4f6;
              }
              .container {
                text-align: center;
                padding: 2rem;
                background: white;
                border-radius: 12px;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                max-width: 400px;
              }
              .error {
                color: #dc2626;
                font-size: 1.2rem;
                margin-bottom: 1rem;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="error">✗ Authentication Failed</div>
              <p>${error.message.includes('unauthorized_client') 
                  ? 'OAuth configuration issue. The callback URL in your X Developer Portal may not match exactly.' 
                  : error.message}</p>
              <p>Please close this window and try again.</p>
              ${error.message.includes('unauthorized_client') 
                ? `<p><strong>Required Callback URL:</strong><br><code style="font-size: 0.9em; padding: 4px; background: #f3f4f6; border-radius: 4px;">${req.protocol}://${req.get('host')}/auth/twitter/callback</code></p>`
                : ''}
            </div>
          </body>
        </html>
      `);
    }
  });
  
  // Debug endpoint to show exact OAuth configuration
  router.get("/api/auth/x/debug", (req, res) => {
    const status = getXAuthStatus();
    const validation = validateXAuthEnvironment();
    
    // Get the exact callback URL that will be used
    const callbackUrl = status.callbackUrl;
    const currentUrl = `${req.protocol}://${req.get('host')}/auth/twitter/callback`;
    
    res.json({
      configured: status.configured,
      clientId: status.clientId,
      hasClientSecret: status.hasClientSecret,
      callbackUrl: callbackUrl,
      currentRequestUrl: currentUrl,
      urlsMatch: callbackUrl === currentUrl,
      validation: validation,
      environment: {
        replit_domains: process.env.REPLIT_DOMAINS,
        repl_slug: process.env.REPL_SLUG,
        repl_owner: process.env.REPL_OWNER,
        node_env: process.env.NODE_ENV
      },
      headers: {
        host: req.get('host'),
        'x-forwarded-proto': req.get('x-forwarded-proto'),
        'x-forwarded-host': req.get('x-forwarded-host'),
        'x-forwarded-port': req.get('x-forwarded-port'),
        'x-real-ip': req.get('x-real-ip')
      },
      recommendations: [
        'Ensure callback URL in X Developer Portal matches exactly',
        'Check that X_CLIENT_ID and X_CLIENT_SECRET are correctly set',
        'Verify your X app has the required permissions',
        'Make sure your X app is not suspended or restricted'
      ]
    });
  });

  // Check auth status for frontend polling
  router.get("/api/auth/x/check", (req, res) => {
    const isAuthenticated = userAuthData.authenticated && 
                           userAuthData.timestamp && 
                           (Date.now() - userAuthData.timestamp < 3600000); // 1 hour expiry
    
    console.log('X Auth Check:', {
      authenticated: userAuthData.authenticated,
      timestamp: userAuthData.timestamp,
      isAuthenticated,
      timeSinceAuth: userAuthData.timestamp ? Date.now() - userAuthData.timestamp : null
    });
    
    res.json({ 
      authenticated: isAuthenticated,
      accessToken: isAuthenticated ? userAuthData.accessToken : null,
      xHandle: isAuthenticated ? userAuthData.xHandle : null
    });
  });

  // Reset auth state (for testing or logout)
  router.post("/api/auth/x/reset", (req, res) => {
    userAuthData = {
      authenticated: false,
      accessToken: null,
      refreshToken: null,
      timestamp: null,
      xHandle: null
    };
    
    console.log('X Auth state reset');
    res.json({ success: true, message: 'Authentication state reset' });
  });
  
  app.use(router);
  
  return http.createServer(app);
}
