
// server/routes.ts
import express from "express";
import http from "http";
// Old workflow imports removed - using only xAI Live Search

import { compileContentForPodcast } from "./services/contentFetcher.js";
import axios from 'axios';
import { generatePodcastScript, parseScriptSegments } from "./services/podcastGenerator.js";
import { getAvailableVoices, generateAudio, checkQuota, combineAudioSegments } from "./services/voiceSynthesis.js";
import { sendPodcastEmail, isEmailServiceConfigured, sendWelcomeEmail } from "./services/emailService.js";
import { storage } from "./storage.js";
import { generateHeadlinesWithLiveSearch } from "./services/liveSearchService.js";
import { 
  registerUser, 
  loginUser, 
  requestPasswordReset, 
  resetPasswordWithToken,
  getUserFromToken 
} from "./services/auth.js";
import { getXLoginUrl, handleXCallback, isXAuthConfigured, getXAuthStatus, validateXAuthEnvironment } from "./services/xAuth.js";
import { fetchUserTimeline } from "./services/xTimeline.js";
import { seedDatabase, clearTestData, getTestUsers } from "./services/devSeeder.js";
import { devAutoLogin, devOnly, addDevHeaders } from "./middleware/devMiddleware.js";
import { runPodcastScheduler, createScheduledPodcastsForUser, processPendingPodcasts } from "./services/podcastScheduler.js";
import rssRoutes from "./routes/rssRoutes.ts";
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { format } from 'date-fns';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Authentication middleware
async function requireAuth(req, res, next) {
  try {
    // Check authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const user = await getUserFromToken(token);
      if (user) {
        req.user = user;
        return next();
      }
    }
    
    // Check session
    if (req.session?.userId) {
      const user = await storage.getUser(req.session.userId);
      if (user) {
        req.user = user;
        return next();
      }
    }
    
    return res.status(401).json({ message: "Authentication required" });
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(401).json({ message: "Authentication required" });
  }
}

export function registerRoutes(app) {
  const router = express.Router();
  
  // Add development middleware
  app.use(addDevHeaders);
  app.use(devAutoLogin);
  
  // Add RSS routes
  app.use(rssRoutes);
  
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
      
      // Check if user has authenticated with X
      const userId = req.session?.userId || req.user?.id;
      let authToken = null;
      
      if (userId) {
        authToken = await storage.getXAuthTokenByUserId(userId);
      }
      
      let userHandle = null;
      let accessToken = null;
      
      if (authToken) {
        try {
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
        } catch (authError) {
          console.log(`❌ X authentication failed: ${authError.message}`);
          console.log(`🔄 Continuing search without X timeline enhancement`);
          // Clear invalid tokens to prevent future attempts
          try {
            await storage.deleteXAuthToken(userId);
            console.log(`🧹 Cleared invalid X tokens for user ${userId}`);
          } catch (deleteError) {
            console.log(`⚠️ Failed to clear invalid tokens: ${deleteError.message}`);
          }
          // Continue without X authentication
          userHandle = null;
          accessToken = null;
        }
      }
      
      // Save user's last search topics
      if (userId) {
        await storage.upsertUserLastSearch({
          userId,
          topics
        });
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
        compiledData: result.compiledData,
        appendix: appendix,
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
    res.json({ 
      headlines: headlinesStore.sort((a, b) => b.engagement - a.engagement),
      compiledData: compiledDataStore,
      appendix: appendixStore
    });
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

  // Get latest compiled data for podcast testing
  router.get("/api/latest-compiled-data", (req, res) => {
    if (!headlinesStore.length) {
      return res.status(404).json({ 
        error: "No headlines available. Generate headlines first to get compiled data.",
        success: false 
      });
    }
    
    res.json({ 
      success: true, 
      headlines: headlinesStore,
      compiledData: compiledDataStore,
      appendix: appendixStore,
      hasCompiledData: !!compiledDataStore,
      hasAppendix: !!appendixStore,
      message: `Latest data available: ${headlinesStore.length} headlines, ${compiledDataStore?.length || 0} chars compiled data`
    });
  });

  // Load cached headlines for testing (used by podcast test page)
  router.post("/api/load-cached-headlines", (req, res) => {
    const { headlines, compiledData, appendix } = req.body;
    
    if (!Array.isArray(headlines)) {
      return res.status(400).json({ error: "Headlines must be an array" });
    }
    
    // Load all data stores to match regular generator behavior
    headlinesStore = headlines;
    compiledDataStore = compiledData || null;
    appendixStore = appendix || null;
    
    console.log(`Loaded ${headlines.length} cached headlines into backend store for testing`);
    if (compiledDataStore) {
      console.log(`Loaded compiled data (${compiledDataStore.length} chars) for testing`);
    }
    if (appendixStore) {
      console.log(`Loaded appendix data for testing`);
    }
    
    res.json({ 
      success: true, 
      message: `Loaded ${headlines.length} cached headlines for testing`,
      headlines: headlinesStore,
      hasCompiledData: !!compiledDataStore,
      hasAppendix: !!appendixStore
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
      
      // Create podcast episode record with enhanced error handling
      try {
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
          message: "Podcast script generated and saved successfully"
        });
      } catch (dbError) {
        console.warn('⚠️ Database save failed, but returning script anyway:', dbError.message);
        
        // Return the script even if database save fails
        res.json({ 
          success: true, 
          episodeId: Date.now(), // Temporary ID since database save failed
          script: script,
          message: "Podcast script generated successfully (database save failed)",
          warning: "Script could not be saved to database due to connectivity issues"
        });
      }
      
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
        const audioResult = await generateAudio(segments[i], episode.voiceId, `${episodeId}-${i}`, episode.userId);
        const audioUrl = typeof audioResult === 'string' ? audioResult : audioResult.audioUrl;
        audioUrls.push(audioUrl);
        console.log(`📻 Generated segment ${i + 1}/${segments.length}: ${audioUrl}`);
      }
      
      // Combine all segments into a single audio file
      console.log(`🔄 Combining ${audioUrls.length} segments into final podcast...`);
      const mainAudioUrl = await combineAudioSegments(audioUrls, episodeId);
      
      // Update episode with audio URL and local path
      await storage.updatePodcastEpisode(parseInt(episodeId), { 
        audioUrl: mainAudioUrl,
        audioLocalPath: mainAudioUrl 
      });
      
      console.log(`✅ Audio generation completed for episode ${episodeId}: ${mainAudioUrl}`);
      console.log(`📁 Current working directory: ${process.cwd()}`);
      console.log(`📁 Audio file should be at: ${path.join(process.cwd(), mainAudioUrl.substring(1))}`);
      
      // Verify the file exists before returning success
      const absolutePath = path.join(process.cwd(), mainAudioUrl.substring(1));
      if (!fs.existsSync(absolutePath)) {
        console.error(`❌ Audio file not found at expected location: ${absolutePath}`);
        throw new Error(`Audio file was generated but not found at: ${absolutePath}`);
      }
      
      res.json({ 
        success: true, 
        audioUrl: mainAudioUrl,
        segments: audioUrls.length
      });
      
    } catch (error) {
      console.error("❌ Error generating audio:", error);
      console.error("Stack trace:", error.stack);
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
      
      // Convert web path to absolute file path - same logic as automatic delivery
      const absoluteAudioPath = episode.audioUrl.startsWith('/Search-Data_&_Podcast-Storage/') 
        ? path.join(process.cwd(), episode.audioUrl.substring(1)) // Remove leading / and join with cwd
        : path.join(process.cwd(), episode.audioUrl);
      
      console.log(`📧 Manual email - Audio file path: ${absoluteAudioPath}`);
      await sendPodcastEmail(email, absoluteAudioPath, 'Current News');
      
      // Update episode email sent timestamp
      await storage.updatePodcastEpisode(parseInt(episodeId), { emailSentAt: new Date() });
      
      res.json({ success: true, message: "Podcast sent to " + email });
      
    } catch (error) {
      console.error("Error emailing podcast:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Podcast audio files are now served from server/index.ts before Vite middleware

  // X OAuth authentication routes (now using database-stored tokens)
  
  // X Auth status endpoint with automatic token refresh
  router.get("/api/auth/x/status", async (req, res) => {
    try {
      const status = getXAuthStatus();
      
      // Check session and database for persistent authentication
      const userId = req.session?.userId;
      let authToken = null;
      
      if (userId) {
        try {
          authToken = await storage.getXAuthTokenByUserId(userId);
        } catch (dbError) {
          console.log('Database check failed:', dbError.message);
        }
      }

      if (!authToken) {
        return res.json({
          ...status,
          authenticated: false,
          accessToken: null,
          xHandle: null,
          persistent: false,
          success: true
        });
      }
      
      // Check if token is expired or about to expire
      const expiresAt = authToken.expiresAt ? new Date(authToken.expiresAt) : null;
      const now = new Date();
      const isExpired = expiresAt && now > expiresAt;
      const isNearExpiry = expiresAt && (expiresAt.getTime() - now.getTime()) < 300000; // 5 minutes buffer
        
      // Attempt automatic token refresh if expired or near expiry
      if ((isExpired || isNearExpiry) && authToken.refreshToken) {
        try {
          console.log(`🔄 Attempting automatic token refresh for user ${userId}...`);
          
          const { createAuthenticatedClient } = await import('./services/xAuth.js');
          const authResult = await createAuthenticatedClient(
            authToken.accessToken,
            authToken.refreshToken,
            expiresAt ? expiresAt.getTime() : null
          );
          
          // If refresh succeeded, update stored tokens
          if (authResult.updatedTokens) {
            await storage.updateXAuthToken(userId, {
              accessToken: authResult.updatedTokens.accessToken,
              refreshToken: authResult.updatedTokens.refreshToken,
              expiresAt: new Date(authResult.updatedTokens.expiresAt)
            });
            
            console.log(`✅ Token automatically refreshed for user ${userId}`);
            
            return res.json({
              ...status,
              authenticated: true,
              accessToken: 'present',
              xHandle: authToken.xHandle || req.session?.xHandle,
              persistent: !!req.session?.xAuthenticated,
              expiresAt: new Date(authResult.updatedTokens.expiresAt),
              refreshed: true,
              success: true
            });
          }
        } catch (refreshError) {
          console.log(`❌ Token refresh failed for user ${userId}:`, refreshError.message);
          // Fall through to return unauthenticated status
        }
      }
      
      // Check if token is still valid (after potential refresh attempt)
      const finalAuthToken = await storage.getXAuthTokenByUserId(userId);
      const finalExpiresAt = finalAuthToken?.expiresAt ? new Date(finalAuthToken.expiresAt) : null;
      const isAuthenticated = !!(finalAuthToken && finalAuthToken.accessToken && 
                                 finalExpiresAt && finalExpiresAt > now);
      
      // Debug logging to track authentication status
      if (userId && process.env.NODE_ENV === 'development') {
        console.log(`🔍 X Auth Status Check for user ${userId}:`);
        console.log(`   - Has auth token: ${!!finalAuthToken}`);
        console.log(`   - Token expires: ${finalAuthToken?.expiresAt}`);
        console.log(`   - Is authenticated: ${isAuthenticated}`);
        console.log(`   - X Handle: ${finalAuthToken?.xHandle}`);
      }
      
      res.json({
        ...status,
        authenticated: isAuthenticated,
        accessToken: finalAuthToken?.accessToken ? 'present' : null,
        xHandle: finalAuthToken?.xHandle || req.session?.xHandle,
        persistent: !!req.session?.xAuthenticated,
        expiresAt: finalAuthToken?.expiresAt,
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
      
      // Calculate ALL possible production domains
      const allPossibleDomains = [];
      
      // Current domain from REPLIT_DOMAINS
      if (process.env.REPLIT_DOMAINS) {
        process.env.REPLIT_DOMAINS.split(',').forEach(domain => {
          allPossibleDomains.push(`https://${domain}/auth/twitter/callback`);
        });
      }
      
      // Production deployment domain (.replit.app)
      if (process.env.REPL_SLUG && process.env.REPL_OWNER) {
        allPossibleDomains.push(`https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.replit.app/auth/twitter/callback`);
        allPossibleDomains.push(`https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co/auth/twitter/callback`);
      }
      
      // Remove duplicates
      const uniqueDomains = [...new Set(allPossibleDomains)];
      
      // Detect environment
      const isProduction = websiteUrl.includes('.replit.app') || 
                          !websiteUrl.includes('.replit.dev');
      
      res.json({
        configured: status.configured,
        environment: isProduction ? 'production' : 'development',
        currentUrls: {
          websiteUrl,
          callbackUrl: status.callbackUrl
        },
        allPossibleDomains: uniqueDomains,
        singleWebsiteUrl: websiteUrl.includes('.replit.app') ? 
          websiteUrl : 
          `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.replit.app`,
        criticalFix: {
          issue: 'OAuth fails because callback URL not in X Developer Portal',
          solution: 'Only ONE Website URL allowed in X Developer Portal',
          action: 'Set Website URL to production domain, add callback URLs'
        },
        xDeveloperPortalConfig: {
          websiteUrl: websiteUrl.includes('.replit.app') ? 
            websiteUrl : 
            `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.replit.app`,
          callbackUrls: uniqueDomains,
          instructions: [
            'Go to X Developer Portal: https://developer.x.com/en/portal/dashboard',
            'Navigate to: Projects & Apps → Your App → Settings',
            'Set ONE Website URL (use production domain)',
            'Add ALL callback URLs above (up to 10 allowed)',
            'Save and test in production'
          ]
        }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Generate X login URL (requires authentication)
  router.post("/api/auth/x/login", requireAuth, async (req, res) => {
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
      
      // Log full environment details for debugging
      console.log('🔐 X OAuth Login Request:');
      console.log('- User ID:', req.user?.id);
      console.log('- User:', req.user?.username);
      console.log('- Environment:', process.env.NODE_ENV);
      console.log('- Validation:', validation);
      
      const authLink = getXLoginUrl(state, req);
      
      // Extract the URL from the auth link object
      const loginUrl = authLink.url;
      
      console.log('✅ Generated auth URL with scopes:', authLink.scope);
      console.log('- State:', state);
      console.log('- URL length:', loginUrl.length);
      console.log('- Full URL:', loginUrl);
      
      res.json({ 
        loginUrl, 
        state,
        success: true,
        validation: validation
      });
    } catch (error) {
      console.error("❌ Error generating X login URL:", error);
      console.error("- Error stack:", error.stack);
      console.error("- X_CLIENT_ID present:", !!process.env.X_CLIENT_ID);
      console.error("- X_CLIENT_SECRET present:", !!process.env.X_CLIENT_SECRET);
      console.error("- Request host:", req.get('host'));
      
      res.status(500).json({ 
        error: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        success: false
      });
    }
  });
  
  // Fetch and store user's X data (timeline working, follows needs Project attachment)
  router.post("/api/x/fetch-user-data", requireAuth, async (req, res) => {
    try {
      const userId = req.user.id;
      
      // Use the authenticated user ID directly
      const sessionUserId = userId;
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
          userId: sessionUserId,
          handle: xUser.username
        });
        
        timelinePosts = await fetchUserTimeline(sessionUserId, 7);
        results.timeline = { success: true, count: timelinePosts.length };
        console.log(`Successfully fetched ${timelinePosts.length} timeline posts`);
      } catch (error) {
        console.log('Timeline endpoint failed:', error.message);
        results.timeline = { success: false, error: error.message };
      }

      // Store whatever data we got
      const storeResult = await storeUserData(storage, sessionUserId, follows, timelinePosts);

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

  // Get stored user follows (requires authentication)
  router.get("/api/x/follows", requireAuth, async (req, res) => {
    try {
      const userId = req.user.id;
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

  // Get stored user timeline posts (requires authentication)
  router.get("/api/x/timeline", requireAuth, async (req, res) => {
    try {
      const userId = req.user.id;
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

  // Get pending scheduled podcasts (requires authentication)
  router.get("/api/scheduled-podcasts/pending", requireAuth, async (req, res) => {
    try {
      const userId = req.user.id;
      const pending = await storage.getScheduledPodcastsForUser(userId);
      const pendingOnly = pending.filter(p => p.status === 'pending');
      
      res.json({
        success: true,
        count: pendingOnly.length,
        podcasts: pendingOnly
      });
    } catch (error) {
      console.error("Error getting pending podcasts:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Quick test endpoint to verify Project attachment fix (requires authentication)
  router.post("/api/x/test-project-attachment", requireAuth, async (req, res) => {
    try {
      const userId = req.user.id;
      
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
  
  // X De-authentication endpoint
  router.post("/api/auth/x/disconnect", requireAuth, async (req, res) => {
    try {
      const userId = req.user.id;
      
      console.log('🔓 X De-authentication request for user:', userId);
      
      // Remove X auth token from database
      await storage.deleteXAuthTokenByUserId(userId);
      
      // Clear session X auth data
      if (req.session) {
        req.session.xAuthenticated = false;
        req.session.xHandle = null;
      }
      
      console.log('✅ X account disconnected successfully');
      
      res.json({
        success: true,
        message: 'X account disconnected successfully'
      });
    } catch (error) {
      console.error('❌ Error disconnecting X account:', error);
      res.status(500).json({
        error: 'Failed to disconnect X account',
        message: error.message
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
      const authResult = await handleXCallback(code, state, req);
      
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
      
      // Get user ID from session (require authentication)
      const userId = req.session?.userId;
      if (!userId) {
        throw new Error('User must be logged in to connect X account');
      }
      
      // Convert expires timestamp to proper Date object for PostgreSQL
      let expiresAtDate;
      if (authResult.expiresAt instanceof Date) {
        expiresAtDate = authResult.expiresAt;
      } else if (typeof authResult.expiresAt === 'number') {
        expiresAtDate = new Date(authResult.expiresAt);
      } else {
        // Calculate from expiresIn if expiresAt is not available
        expiresAtDate = new Date(Date.now() + (authResult.expiresIn * 1000));
      }
      
      console.log(`📅 Token expires at: ${expiresAtDate.toISOString()}`);
      
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
          expiresAt: expiresAtDate
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
          expiresAt: expiresAtDate
        });
        console.log(`🆕 Created new tokens for user ${userId}`);
      }
      
      // Set user session for persistence
      req.session.userId = userId;
      req.session.xAuthenticated = true;
      req.session.xHandle = user.username;
      
      console.log(`💾 Session and database tokens stored for user ${user.username}`);
      
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

  // Check auth status for frontend polling with automatic token refresh (requires authentication)
  router.get("/api/auth/x/check", requireAuth, async (req, res) => {
    try {
      const userId = req.user.id;
      const authToken = await storage.getXAuthTokenByUserId(userId);
      
      if (!authToken) {
        return res.json({ 
          authenticated: false,
          accessToken: null,
          xHandle: null
        });
      }
      
      // Check if token is expired or about to expire
      const expiresAt = authToken.expiresAt ? new Date(authToken.expiresAt) : null;
      const now = new Date();
      const isExpired = expiresAt && now > expiresAt;
      const isNearExpiry = expiresAt && (expiresAt.getTime() - now.getTime()) < 300000; // 5 minutes buffer
      
      // Attempt automatic token refresh if expired or near expiry
      if ((isExpired || isNearExpiry) && authToken.refreshToken) {
        try {
          console.log(`🔄 Attempting automatic token refresh for user ${userId} (check endpoint)...`);
          
          const { createAuthenticatedClient } = await import('./services/xAuth.js');
          const authResult = await createAuthenticatedClient(
            authToken.accessToken,
            authToken.refreshToken,
            expiresAt ? expiresAt.getTime() : null
          );
          
          // If refresh succeeded, update stored tokens
          if (authResult.updatedTokens) {
            await storage.updateXAuthToken(userId, {
              accessToken: authResult.updatedTokens.accessToken,
              refreshToken: authResult.updatedTokens.refreshToken,
              expiresAt: new Date(authResult.updatedTokens.expiresAt)
            });
            
            console.log(`✅ Token automatically refreshed for user ${userId} (check endpoint)`);
            
            return res.json({ 
              authenticated: true,
              accessToken: authResult.updatedTokens.accessToken,
              xHandle: authToken.xHandle,
              refreshed: true
            });
          }
        } catch (refreshError) {
          console.log(`❌ Token refresh failed for user ${userId} (check endpoint):`, refreshError.message);
          // Fall through to return unauthenticated status
        }
      }
      
      // Check final authentication status (after potential refresh attempt)
      const finalAuthToken = await storage.getXAuthTokenByUserId(userId);
      const finalExpiresAt = finalAuthToken?.expiresAt ? new Date(finalAuthToken.expiresAt) : null;
      const isAuthenticated = !!(finalAuthToken && finalAuthToken.accessToken && 
                                 finalExpiresAt && finalExpiresAt > now);
      
      console.log('X Auth Check:', {
        userId,
        hasToken: !!finalAuthToken,
        xHandle: finalAuthToken?.xHandle,
        isAuthenticated,
        expiresAt: finalAuthToken?.expiresAt
      });
      
      res.json({ 
        authenticated: isAuthenticated,
        accessToken: isAuthenticated ? finalAuthToken.accessToken : null,
        xHandle: isAuthenticated ? finalAuthToken.xHandle : null
      });
    } catch (error) {
      console.error("Error checking X auth status:", error);
      res.json({ 
        authenticated: false,
        accessToken: null,
        xHandle: null
      });
    }
  });

  // Reset auth state (for testing or logout) - requires authentication
  router.post("/api/auth/x/reset", requireAuth, async (req, res) => {
    try {
      const userId = req.user.id;
      
      // Delete X auth tokens from database
      const existingToken = await storage.getXAuthTokenByUserId(userId);
      if (existingToken) {
        await storage.updateXAuthToken(userId, {
          accessToken: null,
          refreshToken: null,
          expiresAt: null,
          xUserId: null,
          xHandle: null
        });
        console.log(`🗑️ Cleared X auth tokens for user ${userId}`);
      }
      
      // Clear session X auth data
      if (req.session) {
        req.session.xAuthenticated = false;
        req.session.xHandle = null;
      }
      
      console.log('X Auth state reset');
      res.json({ success: true, message: 'X authentication reset successfully' });
    } catch (error) {
      console.error("Error resetting X auth:", error);
      res.status(500).json({ success: false, message: 'Failed to reset X authentication' });
    }
  });

  // Podcast preferences routes
  router.get("/api/podcast-preferences", requireAuth, async (req, res) => {
    try {
      const userId = req.user.id;
      const preferences = await storage.getPodcastPreferences(userId);
      res.json(preferences || null);
    } catch (error) {
      console.error("Error fetching podcast preferences:", error);
      res.status(500).json({ error: "Failed to fetch podcast preferences" });
    }
  });

  router.post("/api/podcast-preferences", requireAuth, async (req, res) => {
    try {
      const userId = req.user.id;
      const { enabled, cadence, customDays, times, topics, duration, voiceId, enhanceWithX, timezone } = req.body;
      
      // Validate input
      if (!cadence || !times || !times.length || !topics || !topics.length || !duration || !voiceId) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      
      // Delete any existing pending scheduled podcasts for this user
      // This ensures old schedules don't interfere with new preferences
      await storage.deletePendingScheduledPodcastsForUser(userId);
      
      // Check if preferences already exist
      const existing = await storage.getPodcastPreferences(userId);
      
      let savedPreferences;
      if (existing) {
        // Update existing preferences
        savedPreferences = await storage.updatePodcastPreferences(userId, {
          enabled,
          cadence,
          customDays,
          times,
          topics,
          duration,
          voiceId,
          enhanceWithX,
          timezone
        });
      } else {
        // Create new preferences
        savedPreferences = await storage.createPodcastPreferences({
          userId,
          enabled,
          cadence,
          customDays,
          times,
          topics,
          duration,
          voiceId,
          enhanceWithX,
          timezone
        });
      }
      
      // Create scheduled podcasts for each delivery time if enabled
      if (savedPreferences && enabled) {
        // Re-fetch preferences to ensure we have the latest data
        const freshPreferences = await storage.getPodcastPreferences(userId);
        console.log('🔍 Fresh preferences from DB:', {
          times: freshPreferences.times,
          timezone: freshPreferences.timezone,
          cadence: freshPreferences.cadence
        });
        
        // Clean up any incorrect statuses before creating new schedules
        const { cleanupPodcastStatuses } = await import('./services/cleanupPodcastStatuses.js');
        await cleanupPodcastStatuses();
        
        const { createScheduledPodcastsForUser, processPendingPodcasts } = await import('./services/podcastScheduler.js');
        await createScheduledPodcastsForUser(userId, freshPreferences);
        
        // Immediately process any podcasts that are due now (don't wait for interval)
        await processPendingPodcasts();
      }
      
      res.json(savedPreferences);
    } catch (error) {
      console.error("Error saving podcast preferences:", error);
      res.status(500).json({ error: "Failed to save podcast preferences" });
    }
  });

  router.patch("/api/podcast-preferences", requireAuth, async (req, res) => {
    try {
      const userId = req.user.id;
      const updates = req.body;
      
      // Delete any existing pending scheduled podcasts for this user
      // This ensures old schedules don't interfere with updated preferences
      await storage.deletePendingScheduledPodcastsForUser(userId);
      
      const updated = await storage.updatePodcastPreferences(userId, updates);
      if (!updated) {
        return res.status(404).json({ error: "Podcast preferences not found" });
      }
      
      // Re-create scheduled podcasts if enabled
      if (updated.enabled) {
        // Re-fetch preferences to ensure we have the latest data
        const freshPreferences = await storage.getPodcastPreferences(userId);
        console.log('🔍 Fresh preferences from DB (PATCH):', {
          times: freshPreferences.times,
          timezone: freshPreferences.timezone,
          cadence: freshPreferences.cadence
        });
        
        // Clean up any incorrect statuses before creating new schedules
        const { cleanupPodcastStatuses } = await import('./services/cleanupPodcastStatuses.js');
        await cleanupPodcastStatuses();
        
        const { createScheduledPodcastsForUser, processPendingPodcasts } = await import('./services/podcastScheduler.js');
        await createScheduledPodcastsForUser(userId, freshPreferences);
        
        // Immediately process any podcasts that are due now (don't wait for interval)
        await processPendingPodcasts();
      }
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating podcast preferences:", error);
      res.status(500).json({ error: "Failed to update podcast preferences" });
    }
  });

  // Get recent podcast episodes
  router.get("/api/podcast-episodes/recent", requireAuth, async (req, res) => {
    try {
      const userId = req.user.id;
      const limit = parseInt(req.query.limit as string) || 5;
      
      const episodes = await storage.getRecentPodcastEpisodes(userId, limit);
      res.json(episodes);
    } catch (error) {
      console.error("Error fetching recent podcast episodes:", error);
      res.status(500).json({ error: "Failed to fetch recent podcast episodes" });
    }
  });

  // Get user's last search topics
  router.get("/api/user/last-topics", requireAuth, async (req, res) => {
    try {
      const userId = req.user.id;
      const lastSearch = await storage.getUserLastSearch(userId);
      res.json(lastSearch?.topics || []);
    } catch (error) {
      console.error("Error fetching last topics:", error);
      res.status(500).json({ error: "Failed to fetch last topics" });
    }
  });

  // Development-only routes
  router.post("/api/dev/seed-database", devOnly, async (req, res) => {
    try {
      const result = await seedDatabase();
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  router.post("/api/dev/clear-data", devOnly, async (req, res) => {
    try {
      const result = await clearTestData();
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  router.get("/api/dev/users", devOnly, (req, res) => {
    const testUsers = getTestUsers();
    res.json({ 
      users: testUsers,
      currentUser: req.user ? {
        id: req.user.id,
        username: req.user.username,
        email: req.user.email
      } : null
    });
  });
  
  // Test endpoint to trigger immediate podcast delivery
  router.post("/api/dev/test-immediate-podcast", devOnly, requireAuth, async (req, res) => {
    try {
      const userId = req.user.id;
      
      // Get user's podcast preferences
      const preferences = await storage.getUserPodcastPreferences(userId);
      if (!preferences || !preferences.enabled) {
        return res.status(400).json({ error: "Podcast preferences not enabled" });
      }
      
      console.log(`🧪 Creating immediate test podcast for user ${userId}`);
      
      // Create a scheduled podcast for RIGHT NOW
      const now = new Date();
      const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);
      
      const scheduled = await storage.createScheduledPodcast({
        userId: userId,
        scheduledFor: now, // Schedule for now
        deliveryTime: fiveMinutesFromNow, // Delivery in 5 minutes
        preferenceSnapshot: {
          topics: preferences.topics,
          duration: preferences.duration,
          voiceId: preferences.voiceId,
          enhanceWithX: preferences.enhanceWithX,
          cadence: preferences.cadence,
          times: preferences.times
        },
        status: 'pending'
      });
      
      console.log(`✅ Created test podcast with ID ${scheduled.id} for immediate processing`);
      
      // Immediately process this podcast
      const { processPendingPodcasts } = await import('./services/podcastScheduler.js');
      await processPendingPodcasts();
      
      res.json({ 
        success: true, 
        message: "Test podcast created and processing started",
        scheduledId: scheduled.id
      });
      
    } catch (error) {
      console.error("Error creating test podcast:", error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Direct test podcast generation - bypasses scheduling entirely
  router.post("/api/dev/test-podcast-direct", requireAuth, async (req, res) => {
    try {
      const userId = req.user.id;
      
      // Get user's podcast preferences and info
      const preferences = await storage.getPodcastPreferences(userId);
      if (!preferences || !preferences.enabled) {
        return res.status(400).json({ error: "Podcast preferences not enabled" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      console.log(`🚀 Direct test podcast triggered for user ${user.username} (${user.email})`);

      // Extract preferences
      const topics = preferences.topics || [];
      const validTopics = topics.filter(topic => topic && topic.trim());
      
      if (validTopics.length === 0) {
        return res.status(400).json({ error: "No valid topics configured" });
      }
      
      const duration = preferences.duration || 5;
      const voiceId = preferences.voiceId || 'ErXwobaYiN019PkySvjV';
      const enhanceWithX = preferences.enhanceWithX || false;

      // Get X auth if enabled
      let userHandle = null;
      let accessToken = null;
      
      if (enhanceWithX) {
        const xAuth = await storage.getXAuthTokenByUserId(userId);
        if (xAuth) {
          userHandle = xAuth.xHandle;
          accessToken = xAuth.accessToken;
        }
      }

      // Import necessary services
      const { getCompiledDataForPodcast } = await import('./services/liveSearchService.js');
      const { generatePodcastScript } = await import('./services/podcastGenerator.js');
      const { generateAudio } = await import('./services/voiceSynthesis.js');
      const { sendPodcastEmail } = await import('./services/emailService.js');
      const path = await import('path');

      // Get compiled data directly
      console.log(`📰 Fetching compiled data for topics: ${validTopics.join(', ')}`);
      const compiledDataResult = await getCompiledDataForPodcast(
        validTopics,
        userId,
        userHandle,
        accessToken
      );
      
      if (!compiledDataResult.compiledData) {
        return res.status(500).json({ error: "Failed to generate compiled data" });
      }

      console.log(`✅ Compiled data generated: ${compiledDataResult.compiledData.length} characters`);

      // Generate podcast script
      console.log(`📝 Generating ${duration}-minute podcast script`);
      const script = await generatePodcastScript(
        compiledDataResult.compiledData,
        null,
        duration,
        "Current News Test"
      );

      // Create podcast episode record
      const episode = await storage.createPodcastEpisode({
        userId: userId,
        topics: validTopics,
        durationMinutes: duration,
        voiceId: voiceId,
        script,
        headlineIds: [],
        wasScheduled: false
      });

      // Generate audio
      console.log(`🎵 Generating audio with voice ${voiceId}`);
      const audioResult = await generateAudio(script, voiceId, episode.id, userId);

      // Update episode with audio URL
      await storage.updatePodcastEpisode(episode.id, {
        audioUrl: typeof audioResult === 'string' ? audioResult : audioResult.audioUrl,
        audioLocalPath: typeof audioResult === 'string' ? audioResult : audioResult.audioLocalPath
      });

      // Send email
      console.log(`📧 Sending test podcast to ${user.email}`);
      const audioFilePath = typeof audioResult === 'string' 
        ? audioResult 
        : (audioResult.filePath || audioResult.audioUrl);
      
      const absoluteAudioPath = audioFilePath.startsWith('/Search-Data_&_Podcast-Storage/') 
        ? path.default.join(process.cwd(), audioFilePath.substring(1))
        : audioFilePath;
      
      await sendPodcastEmail(user.email, absoluteAudioPath, "Current News Test");

      // Update episode with email sent timestamp
      await storage.updatePodcastEpisode(episode.id, {
        emailSentAt: new Date()
      });

      console.log(`✅ Direct test podcast successfully generated and sent to ${user.email}`);
      
      res.json({ 
        success: true, 
        episode,
        message: `Test podcast generated and sent to ${user.email}`
      });
      
    } catch (error) {
      console.error("Error generating direct test podcast:", error);
      res.status(500).json({ 
        error: error.message || "Failed to generate test podcast",
        details: error.stack
      });
    }
  });

  // Podcast health monitoring endpoint
  router.get("/api/podcast-health", requireAuth, async (req, res) => {
    try {
      const userId = req.user.id;
      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      // Get all scheduled podcasts for the user
      const allPodcasts = await storage.getScheduledPodcastsForUser(userId);
      
      // Filter stuck processing podcasts (processing for more than 30 minutes)
      const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
      const stuckProcessing = allPodcasts.filter(p => 
        p.status === 'processing' && 
        new Date(p.scheduledFor) < thirtyMinutesAgo
      );
      
      // Filter failed podcasts in last 24 hours
      const recentFailed = allPodcasts.filter(p => 
        p.status === 'failed' && 
        new Date(p.scheduledFor) > twentyFourHoursAgo
      );
      
      // Filter pending podcasts that should have run (scheduled more than 5 minutes ago)
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
      const missedPending = allPodcasts.filter(p => 
        p.status === 'pending' && 
        new Date(p.scheduledFor) < fiveMinutesAgo
      );
      
      // Get next scheduled deliveries (next 7 days)
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const upcomingDeliveries = allPodcasts.filter(p => 
        p.status === 'pending' && 
        new Date(p.deliveryTime) > now && 
        new Date(p.deliveryTime) < sevenDaysFromNow
      ).sort((a, b) => new Date(a.deliveryTime).getTime() - new Date(b.deliveryTime).getTime());
      
      res.json({
        currentTime: now.toISOString(),
        health: {
          stuckProcessing: stuckProcessing.map(p => ({
            id: p.id,
            scheduledFor: p.scheduledFor,
            stuckMinutes: Math.round((now.getTime() - new Date(p.scheduledFor).getTime()) / (1000 * 60))
          })),
          recentFailed: recentFailed.map(p => ({
            id: p.id,
            scheduledFor: p.scheduledFor,
            errorMessage: p.errorMessage || 'Unknown error'
          })),
          missedPending: missedPending.map(p => ({
            id: p.id,
            scheduledFor: p.scheduledFor,
            minutesOverdue: Math.round((now.getTime() - new Date(p.scheduledFor).getTime()) / (1000 * 60))
          })),
          upcomingDeliveries: upcomingDeliveries.slice(0, 10).map(p => ({
            id: p.id,
            deliveryTime: p.deliveryTime,
            scheduledFor: p.scheduledFor,
            hoursUntilDelivery: Math.round((new Date(p.deliveryTime).getTime() - now.getTime()) / (1000 * 60 * 60) * 10) / 10
          }))
        },
        summary: {
          stuckCount: stuckProcessing.length,
          failedCount: recentFailed.length,
          missedCount: missedPending.length,
          upcomingCount: upcomingDeliveries.length,
          isHealthy: stuckProcessing.length === 0 && missedPending.length === 0
        }
      });
      
    } catch (error) {
      console.error("Error checking podcast health:", error);
      res.status(500).json({ error: error.message });
    }
  });

  router.post("/api/dev/switch-user/:userId", devOnly, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Update session
      req.session.userId = user.id;
      req.session.username = user.username;
      
      // Check X auth status
      const xAuth = await storage.getXAuthTokenByUserId(user.id);
      if (xAuth) {
        req.session.xAuthenticated = true;
        req.session.xHandle = xAuth.xHandle;
      } else {
        req.session.xAuthenticated = false;
        req.session.xHandle = null;
      }
      
      res.json({ 
        success: true, 
        user: {
          id: user.id,
          username: user.username,
          email: user.email
        },
        xAuth: xAuth ? {
          xHandle: xAuth.xHandle,
          authenticated: true
        } : { authenticated: false }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  router.get("/api/dev/environment", devOnly, (req, res) => {
    res.json({
      environment: 'development',
      nodeEnv: process.env.NODE_ENV,
      replitDomains: process.env.REPLIT_DOMAINS,
      currentUser: req.user ? {
        id: req.user.id,
        username: req.user.username
      } : null,
      autoLoginEnabled: true
    });
  });
  
  // Production OAuth debug endpoint - available in all environments
  router.get("/api/auth/x/production-debug", (req, res) => {
    const actualHost = req.get('host');
    const forwardedHost = req.get('x-forwarded-host');
    const forwardedProto = req.get('x-forwarded-proto');
    const protocol = forwardedProto || req.protocol;
    const finalHost = forwardedHost || actualHost;
    
    res.json({
      currentEnvironment: {
        NODE_ENV: process.env.NODE_ENV,
        REPL_SLUG: process.env.REPL_SLUG,
        REPL_OWNER: process.env.REPL_OWNER,
        REPLIT_DOMAINS: process.env.REPLIT_DOMAINS?.split(',') || []
      },
      requestInfo: {
        protocol: protocol,
        host: finalHost,
        originalHost: actualHost,
        forwardedHost: forwardedHost,
        fullUrl: `${protocol}://${finalHost}`,
        isProduction: finalHost?.includes('.replit.app') || false
      },
      expectedCallbackUrl: `${protocol}://${finalHost}/auth/twitter/callback`,
      requiredXDeveloperPortalConfig: {
        websiteUrl: `${protocol}://${finalHost}`,
        callbackUrl: `${protocol}://${finalHost}/auth/twitter/callback`,
        note: "Both Website URL and Callback URL must be configured in X Developer Portal"
      }
    });
  });
  
  // X OAuth test endpoint - tests actual URL generation
  router.get("/api/auth/x/test-oauth", (req, res) => {
    try {
      const validation = validateXAuthEnvironment();
      
      // Try to generate a test OAuth URL without storing session
      let testUrl = null;
      let error = null;
      
      try {
        const state = 'test-' + Date.now();
        const authLink = getXLoginUrl(state, req);
        testUrl = authLink.url ? 'Generated successfully' : 'Failed to generate';
      } catch (err) {
        error = err.message;
      }
      
      res.json({
        oauth_configuration: {
          clientIdPresent: !!process.env.X_CLIENT_ID,
          clientSecretPresent: !!process.env.X_CLIENT_SECRET,
          clientIdLength: process.env.X_CLIENT_ID?.length || 0,
          clientSecretLength: process.env.X_CLIENT_SECRET?.length || 0,
          validation: validation
        },
        test_result: {
          urlGeneration: testUrl,
          error: error
        },
        important_notes: [
          "Ensure your X App is attached to a Project (not standalone)",
          "Set App environment to 'Production' in X Developer Portal",
          "Callback URL must match exactly: https://current-news.replit.app/auth/twitter/callback",
          "If error mentions 'client-not-enrolled', attach App to a Project"
        ]
      });
    } catch (error) {
      res.status(500).json({ 
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });

  // Authentication routes
  router.post("/api/auth/register", async (req, res) => {
    try {
      const { username, email, password } = req.body;
      
      if (!username || !email || !password) {
        return res.status(400).json({ message: "Username, email and password are required" });
      }
      
      if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters long" });
      }
      
      const { user, token } = await registerUser(username, email, password);
      
      // Set session if available
      if (req.session) {
        req.session.userId = user.id;
        req.session.username = user.username;
      }
      
      // Send welcome email
      await sendWelcomeEmail(user.email, user.username);
      
      res.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email
        },
        token
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(400).json({ message: error.message });
    }
  });

  router.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
      }
      
      const { user, token } = await loginUser(username, password);
      
      // Set session if available
      if (req.session) {
        req.session.userId = user.id;
        req.session.username = user.username;
      }
      
      res.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email
        },
        token
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(401).json({ message: error.message });
    }
  });

  router.post("/api/auth/logout", (req, res) => {
    if (req.session) {
      req.session.destroy((err) => {
        if (err) {
          console.error("Logout error:", err);
          return res.status(500).json({ message: "Error logging out" });
        }
        res.json({ success: true, message: "Logged out successfully" });
      });
    } else {
      res.json({ success: true, message: "Logged out successfully" });
    }
  });

  router.get("/api/auth/me", async (req, res) => {
    try {
      // Check authorization header
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const user = await getUserFromToken(token);
        if (user) {
          return res.json({
            user: {
              id: user.id,
              username: user.username,
              email: user.email
            }
          });
        }
      }
      
      // Check session
      if (req.session?.userId) {
        const user = await storage.getUser(req.session.userId);
        if (user) {
          return res.json({
            user: {
              id: user.id,
              username: user.username,
              email: user.email
            }
          });
        }
      }
      
      res.status(401).json({ message: "Not authenticated" });
    } catch (error) {
      console.error("Auth check error:", error);
      res.status(401).json({ message: "Not authenticated" });
    }
  });

  router.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }
      
      const result = await requestPasswordReset(email);
      res.json(result);
    } catch (error) {
      console.error("Password reset request error:", error);
      res.status(500).json({ message: "Error processing password reset request" });
    }
  });

  router.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, password } = req.body;
      
      if (!token || !password) {
        return res.status(400).json({ message: "Token and password are required" });
      }
      
      if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters long" });
      }
      
      const result = await resetPasswordWithToken(token, password);
      res.json(result);
    } catch (error) {
      console.error("Password reset error:", error);
      res.status(400).json({ message: error.message });
    }
  });

  // Development-only podcast test endpoint
  if (process.env.NODE_ENV === 'development') {
    router.post("/api/dev/test-podcast-delivery", requireAuth, async (req, res) => {
      try {
        const userId = req.user.id;
        
        // Get user's podcast preferences and info
        const preferences = await storage.getPodcastPreferences(userId);
        if (!preferences || !preferences.enabled) {
          return res.status(400).json({ error: "Podcast preferences not enabled" });
        }

        const user = await storage.getUser(userId);
        if (!user) {
          return res.status(404).json({ error: "User not found" });
        }

        console.log(`🧪 Test podcast delivery triggered for user ${user.username} (${user.email})`);

        // Extract preferences
        const topics = preferences.topics || [];
        const duration = preferences.duration || 5;
        const voiceId = preferences.voiceId || 'ErXwobaYiN019PkySvjV';
        const enhanceWithX = preferences.enhanceWithX || false;

        // Get X auth if enabled
        let userHandle = null;
        let accessToken = null;
        
        if (enhanceWithX) {
          const xAuth = await storage.getXAuthTokenByUserId(userId);
          if (xAuth) {
            userHandle = xAuth.xHandle;
            accessToken = xAuth.accessToken;
          }
        }

        // Import required functions
        const { generateHeadlinesWithLiveSearch } = await import('./services/liveSearchService.js');
        const { generatePodcastScript } = await import('./services/podcastGenerator.js');
        const { generateAudio } = await import('./services/voiceSynthesis.js');
        const { sendPodcastEmail } = await import('./services/emailService.js');

        // Generate headlines
        console.log(`📰 Generating headlines for topics: ${topics.join(', ')}`);
        const headlinesResult = await generateHeadlinesWithLiveSearch(
          topics,
          userId,
          userHandle,
          accessToken
        );

        if (!headlinesResult.headlines || headlinesResult.headlines.length === 0) {
          return res.status(400).json({ error: "No headlines generated" });
        }

        // Generate podcast script
        console.log(`📝 Generating ${duration}-minute podcast script`);
        const script = await generatePodcastScript(
          headlinesResult.compiledData,
          headlinesResult.appendix,
          duration,
          "Current News"
        );

        // Create podcast episode record
        const episode = await storage.createPodcastEpisode({
          userId,
          topics,
          durationMinutes: duration,
          voiceId,
          script,
          headlineIds: headlinesResult.headlines.map(h => h.id),
          wasScheduled: false
        });

        // Generate audio
        console.log(`🎵 Generating audio with voice ${voiceId}`);
        const audioResult = await generateAudio(script, voiceId, episode.id, userId);
        
        // Update episode with audio URL and local path
        await storage.updatePodcastEpisode(episode.id, {
          audioUrl: typeof audioResult === 'string' ? audioResult : audioResult.audioUrl,
          audioLocalPath: typeof audioResult === 'string' ? audioResult : audioResult.audioLocalPath
        });

        // Send email
        const audioFilePath = typeof audioResult === 'string' 
          ? audioResult 
          : (audioResult.filePath || audioResult.audioUrl);
        
        const audioPath = audioFilePath.startsWith('/Search-Data_&_Podcast-Storage/') 
          ? path.join(process.cwd(), audioFilePath.substring(1))
          : path.join(process.cwd(), audioFilePath);

        console.log(`📧 Sending test podcast to ${user.email}`);
        console.log(`📧 Audio file path: ${audioPath}`);
        
        await sendPodcastEmail(user.email, audioPath, "Current News Test");

        // Update episode with email sent timestamp
        await storage.updatePodcastEpisode(episode.id, {
          emailSentAt: new Date()
        });

        console.log(`✅ Test podcast successfully generated and sent to ${user.email}`);
        
        res.json({ 
          success: true, 
          episode,
          message: `Test podcast generated and sent to ${user.email}`
        });
      } catch (error) {
        console.error("Error generating test podcast:", error);
        res.status(500).json({ error: error.message || "Failed to generate test podcast" });
      }
    });

    // Clean up pending podcasts for development testing
    router.post("/api/dev/cleanup-pending-podcasts", requireAuth, async (req, res) => {
      try {
        const userId = req.user.id;
        
        // Get all pending podcasts for this user
        const pendingPodcasts = await storage.getScheduledPodcastsForUser(userId);
        const pending = pendingPodcasts.filter(p => p.status === 'pending');
        
        console.log(`🧹 Found ${pending.length} pending podcasts to clean up for user ${userId}`);
        
        // Mark all as cancelled
        for (const podcast of pending) {
          await storage.updateScheduledPodcast(podcast.id, { 
            status: 'cancelled' as const,
            completedAt: new Date()
          });
        }
        
        res.json({ 
          success: true, 
          message: `Cleaned up ${pending.length} pending podcasts`,
          cleaned: pending.length
        });
      } catch (error) {
        console.error("Error cleaning up podcasts:", error);
        res.status(500).json({ error: "Failed to clean up podcasts" });
      }
    });
  }

  // Podcast scheduler routes
  router.post("/api/scheduler/run", requireAuth, async (req, res) => {
    try {
      console.log('🔄 Manual scheduler run triggered by user:', req.user.username);
      await runPodcastScheduler();
      res.json({ success: true, message: "Scheduler run completed" });
    } catch (error) {
      console.error("Error running scheduler:", error);
      res.status(500).json({ error: "Failed to run scheduler", message: error.message });
    }
  });

  router.post("/api/scheduler/create-scheduled", requireAuth, async (req, res) => {
    try {
      console.log('📅 Creating scheduled podcasts triggered by user:', req.user.username);
      await createScheduledPodcasts();
      res.json({ success: true, message: "Scheduled podcasts created" });
    } catch (error) {
      console.error("Error creating scheduled podcasts:", error);
      res.status(500).json({ error: "Failed to create scheduled podcasts", message: error.message });
    }
  });

  router.post("/api/scheduler/process-pending", requireAuth, async (req, res) => {
    try {
      console.log('⚡ Processing pending podcasts triggered by user:', req.user.username);
      await processPendingPodcasts();
      res.json({ success: true, message: "Pending podcasts processed" });
    } catch (error) {
      console.error("Error processing pending podcasts:", error);
      res.status(500).json({ error: "Failed to process pending podcasts", message: error.message });
    }
  });

  router.get("/api/scheduler/status", requireAuth, async (req, res) => {
    try {
      const userId = req.user.id;
      const preferences = await storage.getPodcastPreferences(userId);
      const scheduledPodcasts = await storage.getScheduledPodcastsForUser(userId);
      const pendingPodcasts = await storage.getPendingPodcastsDue();
      
      res.json({
        user: {
          id: userId,
          username: req.user.username,
          email: req.user.email
        },
        preferences,
        scheduledPodcasts,
        pendingPodcasts: pendingPodcasts.filter(p => p.userId === userId),
        totalPendingSystemWide: pendingPodcasts.length
      });
    } catch (error) {
      console.error("Error getting scheduler status:", error);
      res.status(500).json({ error: "Failed to get scheduler status", message: error.message });
    }
  });
  
  app.use(router);
  
  return http.createServer(app);
}
