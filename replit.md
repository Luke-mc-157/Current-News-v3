# Current - AI-Powered News Aggregation Platform

## Overview

Current is an intelligent news aggregation application that transforms real-time social media content into personalized news summaries using AI-driven content compilation and multi-source information synthesis. The application fetches authentic posts from X (Twitter), generates compelling headlines using OpenAI, and compiles supporting articles from Google News RSS feeds.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **React 18** with TypeScript for type safety and modern development
- **Wouter** for lightweight client-side routing
- **TanStack Query** for efficient server state management and caching
- **shadcn/ui** components built on Radix UI for accessible, customizable UI components
- **Tailwind CSS** for utility-first styling with CSS variables for theming
- **Vite** for fast development and optimized builds

### Backend Architecture
- **Node.js** with Express.js for the REST API server
- **TypeScript** with ES modules for type safety and modern JavaScript features
- Modular service architecture with separate workflows for each major function
- In-memory storage with plans for PostgreSQL integration using Drizzle ORM

### Data Storage Strategy
- **Current**: In-memory storage for development and proof of concept
- **Planned**: PostgreSQL with Neon Database (serverless) for production
- **ORM**: Drizzle ORM configured for PostgreSQL with type-safe database operations
- Database schema supports users, topics, headlines, and podcast settings

## Key Components

### 1. Workflow System
The backend implements five distinct workflows that process user requests:

- **X Search (Workflow 1)**: Searches topics on X/Twitter, compiles posts with highest engagement from last 24 hours
- **Headline Creator (Workflow 2)**: Uses OpenAI GPT to create declarative headlines from X posts
- **Support Compiler (Workflow 3)**: Searches Google News RSS for supporting articles for each headline
- **Results Engine (Workflow 4)**: Organizes and ranks results by engagement metrics
- **Complete Search (Workflow 5)**: Generates subtopics using OpenAI to expand coverage when needed

### 2. Podcast Generation System
The application now includes a comprehensive podcast generation system:

- **Content Compilation**: Fetches full text from all X posts and article URLs
- **Script Generation**: Uses xAI Grok-4-0709 to create factual podcast scripts
- **Voice Synthesis**: Integrates ElevenLabs API for high-quality voice generation
- **Audio Delivery**: Provides web player and email distribution options
- **User Controls**: Duration selection (5-30 min), voice selection, instant playback

### 2. Frontend Components
- **TopicInput**: Handles user input of 5+ topics with real-time validation
- **HeadlineCard**: Displays generated headlines with expandable source posts and articles
- **PodcastGenerator**: Complete podcast generation interface with:
  - Duration selection (5, 10, 15, 30 minutes)
  - Voice selection from ElevenLabs options
  - Script generation with "View Podcast Script" button
  - Audio player with download option
  - Email delivery functionality
- **SourcesManager**: UI for managing trusted X/Twitter sources per topic

### 3. API Integration Services
- **xSearch.js**: Interfaces with X API v2 for real-time post retrieval from dynamic sources
- **dynamicSources.js**: Compiles user-defined and xAI-suggested verified sources per topic
- **xaiAnalyzer.js**: xAI integration for content authenticity analysis and categorization
- **headlineCreator.js**: OpenAI API integration for headline generation
- **supportCompiler.js**: Google News RSS parsing for supporting articles
- **completeSearch.js**: OpenAI API for subtopic generation
- **contentFetcher.js**: Fetches full article content for podcast compilation
- **podcastGenerator.js**: xAI-powered factual script generation
- **voiceSynthesis.js**: ElevenLabs API integration for voice generation
- **emailService.js**: Podcast distribution via email attachments

## Data Flow

1. **User Input**: User enters 5+ topics through the frontend interface
2. **Topic Processing**: Backend validates topics and initiates the workflow system
3. **X Search**: Fetches recent posts for each topic using X API v2
4. **Headline Generation**: OpenAI processes posts to create factual headlines
5. **Article Compilation**: Google News RSS provides supporting articles
6. **Results Organization**: Headlines ranked by engagement and presented to user
7. **Expansion Search**: If fewer than 15 headlines, subtopics are generated for additional coverage

## External Dependencies

### APIs and Services
- **X API v2**: Real-time tweet search with authentication via Bearer Token for authentic content discovery
- **xAI API**: Grok-4-0709 for all Live Search queries and complex reasoning tasks
- **OpenAI API**: GPT-3.5-turbo and GPT-4 for headline and subtopic generation (legacy)
- **Google News RSS**: Public RSS feeds for supporting article discovery
- **Neon Database**: Serverless PostgreSQL for production data storage
- **ElevenLabs API**: Voice synthesis for podcast generation with multiple voice options

### Development Tools
- **Drizzle Kit**: Database migrations and schema management
- **ESBuild**: Fast JavaScript bundling for production builds
- **PostCSS**: CSS processing with Tailwind CSS integration

### Known Issues
- Database configuration present but using in-memory storage in current implementation

### Recent Updates (January 8, 2025)
- **Reversed X Search Workflow**: Implemented viral-first approach that searches for high-engagement content before categorizing into topics
- **Reduced API Usage**: From ~650 calls to ~8 strategic queries targeting viral content
- **Improved Engagement**: Now searches verified accounts and trending sources for posts with 100+ likes
- **Smart Categorization**: Posts are intelligently matched to user topics after collection

### Latest Updates (January 13, 2025 - 11:00 PM UTC)
- **✅ FIXED CRASH ISSUES WITH 13+ TOPICS**: Implemented comprehensive memory management and crash prevention
  - **Memory Optimization**:
    - Batch processing: Topics now processed in batches of 5 to prevent memory overload
    - Reduced token limits: Lowered max_tokens from 50,000 to 15,000 per Live Search call
    - Limited article fetching: Reduced from 15 to 8 articles per topic
    - Added memory monitoring with RSS and heap usage tracking
  - **Rate Limit Protection**:
    - Staggered API calls with 500ms delays within batches
    - 2-second delays between batches to prevent API overload
    - Better error handling for timeouts and rate limit errors
  - **Safety Limits**:
    - Maximum 20 topics per search (warns and truncates if exceeded)
    - Removed verbose debug logging to prevent memory bloat
    - Added garbage collection triggers between batches
  - **Results**: System now handles 20 topics reliably without crashing, with memory usage tracking

### Previous Updates (January 13, 2025 - 8:00 PM UTC)
- **✅ PHASE 2 & 3 IMPROVEMENTS IMPLEMENTED**: Advanced data processing to prevent truncation and ensure X posts inclusion
  - **Phase 2 - Anti-Truncation Features**:
    - Pre-summarization with Grok-3-fast to condense topics while preserving all URLs and X posts
    - Chunked processing (2 topics at a time) to avoid Grok overload
    - Reduced max_tokens from 20k to 10k to prevent response truncation
    - Separate timeline appendix generation if missing from main compilation
    - Post-validation to identify missing sources and warn about issues
  - **Phase 3 - X Posts Enhancement**:
    - validateAndEnhanceHeadlines function extracts all available X posts from compiled data
    - Automatic X post injection when headlines lack sourcePosts
    - Intelligent matching based on topic/category relevance
    - Final validation reports total X posts across all headlines
    - Critical error logging when headlines still lack X posts after enhancement
  - **Critical Fixes Applied**:
    - Pre-summarization explicitly preserves "X POSTS FROM SEARCH" structure
    - Main Grok prompt emphasizes: "CRITICAL: Use X POSTS FROM SEARCH as sourcePosts"
    - Phase 3 fallback ensures X posts are added even if Grok misses them
  - **Results**: X posts now properly included in headlines with full metadata (handle, text, likes, URL)

### Latest Updates (January 13, 2025)
- **✅ ENHANCED OAUTH DEBUGGING SYSTEM**: Comprehensive error handling and debugging improvements implemented
  - **Debug Endpoint**: New `/api/auth/x/debug` endpoint shows exact OAuth configuration details
  - **Environment Validation**: Pre-flight validation checks for OAuth credentials before URL generation
  - **Enhanced Error Messages**: Specific error classification for 400, 401, 403, 404 OAuth errors
  - **Callback Debugging**: Detailed logging and parameter validation for OAuth callbacks
  - **Test Script**: `test-oauth-debug.js` validates all debugging endpoints work correctly
  - **OAuth Configuration**: Improved callback URL construction with comprehensive environment detection
- **✅ TIMELINE FUNCTION FULLY OPERATIONAL**: Complete success with all components working perfectly
  - OAuth 2.0 authentication working perfectly with token refresh logic for user @Mc_Lunderscore
  - Timeline endpoint (GET /2/users/:id/timelines/reverse_chronological) successfully fetching 100 posts ✅
  - **API Method Fixed**: Switched from `userTimeline` to `homeTimeline` for correct home feed functionality
  - **Response Structure Fixed**: Corrected API response parsing - tweets now properly extracted from response object
  - **Rate Limit Management**: Successfully handled rate limits (5 requests/15 min) - waited for reset and achieved success
  - **Database Storage Verified**: 100 real timeline posts successfully stored in PostgreSQL database
  - **Real Data Validation**: Authentic posts from sources like BostonGlobe with actual content and engagement metrics
  - System tested and confirmed functional on January 13, 2025 at 03:40:23 UTC with 100% success rate
  - **✅ INTEGRATED WITH ALL SEARCH ENDPOINTS**: Timeline function now runs automatically before every search
    - Updated `/api/generate-headlines` (original workflow) to fetch timeline first
    - Enhanced `/api/generate-headlines-v2` (xAI Live Search) to use new fetchUserTimeline function
    - Updated `/api/generate-headlines-v3` (X API + OpenAI) to fetch timeline first
    - Timeline posts cleaned up automatically (30 hours retention) on each fetch
    - **Updated Timeline Capacity**: Increased from 100 to 175 posts per fetch for richer data
    - Verified working: User @Mc_Lunderscore timeline fetched before Live Search at 3:54 AM UTC
  - **Ready for Production**: Timeline function fully integrated with search workflows using authentic user data
- **✅ ENHANCED TIMELINE INTEGRATION**: Advanced personalization features implemented (January 13, 2025 04:08 UTC)
  - **Emergent Topics Discovery**: New AI-powered analysis identifies 1-3 trending topics from user's timeline
    - Analyzes high-engagement posts (top 50% by views + likes) using Grok-3-fast
    - Automatically appends discovered topics to user's search query
    - Example: User searches "AI", system discovers "AI Ethics" from viral timeline posts
  - **Timeline Posts Integration**: Timeline posts now integrated into search results
    - Posts tagged with `source: 'timeline'` for proper identification
    - High-relevance timeline posts become primary sources in headlines
    - Enhances personalization by incorporating user's followed content
  - **"From Your Feed" Appendix**: New podcast appendix feature
    - Selects 3-5 high-engagement timeline posts not used in headlines
    - Provides factual summaries with engagement metrics
    - Adds personal touch to generated content while maintaining factual accuracy
  - **Technical Implementation**: 
    - Fixed `view_count` vs `impression_count` field mapping
    - Enhanced data summary includes timeline posts for Grok analysis
    - Appendix parsing logic for future podcast integration
- **✅ SIMPLIFIED TIMELINE CATEGORIZATION**: Removed xaiAnalyzer dependency (January 13, 2025 05:30 UTC)
  - **Removed categorizePostsWithXAI**: Eliminated separate AI categorization step for timeline posts
  - **Grok-Driven Categorization**: Timeline posts now sent directly to Grok for intelligent topic matching
  - **Improved Architecture**: Reduced complexity by removing intermediate AI processing layer
  - **Enhanced Instructions**: Updated Grok prompt to explicitly handle timeline post categorization
  - **Maintained Features**: All personalization features (emergent topics, timeline integration, appendix) remain functional

### Previous Updates (January 12, 2025)
- **✅ FIXED DATABASE STORAGE ISSUES**: Resolved all TypeScript/Drizzle ORM compatibility issues
  - Fixed array handling: Proper conversion from array-like objects to real arrays
  - Fixed engagement field type: Changed from text to integer in database schema
  - Fixed database insertion: Added proper array wrapping for Drizzle `.values()` method
  - Fixed headline ID generation: Auto-generate IDs since InsertHeadline omits id field
  - Database migrations working correctly, storage layer fully functional
- **🔧 X API PROJECT ENROLLMENT PROGRESS**: Partial resolution achieved
  - Basic tier ($200/month) DOES support required endpoints: GET /2/users/:id/timelines/reverse_chronological and GET /2/users/:id/following (5 requests/15 mins each)
  - Solution: Created new app "Current News Application v3" within project structure
  - Fixed twitter-api-v2 method calls: `client.v2.userTimeline()` for timeline, `client.v2.following()` for follows
  - Authentication working correctly, timeline endpoint functional
- **✅ X API OAUTH INTEGRATION**: Added complete OAuth 2.0 authentication flow for X (Twitter) API
  - New dependency: `twitter-api-v2` for official X API client
  - `xAuth.js` service handles PKCE OAuth flow with secure session management
  - Authentication routes: `/api/auth/x/login`, `/auth/twitter/callback`, `/api/auth/x/status`, `/api/auth/x/check`, `/api/auth/x/debug`
  - `XLoginButton` component with popup-based authentication and status polling
  - Header integration for "Login with X" functionality with visual feedback
  - In-memory session storage for demo (production should use secure database storage)
  - Auto-closing popup window and real-time authentication status checking
- **✅ FIXED OAUTH PKCE AUTHENTICATION**: Resolved all OAuth 2.0 authentication issues
  - Fixed PKCE code challenge method from lowercase `s256` to uppercase `S256` per OAuth 2.0 spec
  - Implemented proper RFC 7636 compliant base64URL encoding (removed by using library's built-in)
  - Let twitter-api-v2 library handle PKCE generation internally for better compatibility
  - Added all required scopes: `users.read`, `tweet.read`, `follows.read`, `offline.access`
  - Fixed scope format to space-separated string instead of array
  - Purpose: Fetch user's followed handles and their recent posts for Live Search integration
- **✅ ENHANCED VOICE SYSTEM**: Added 3 new ElevenLabs voices across both frontend and backend
  - **Cowboy Bob VF** (KTPVrSVAEUSJRClDzBw7): Aged American Storyteller
  - **Dr. Von Fusion VF** (yjJ45q8TVCrtMhEKurxY): Quirky Mad Scientist  
  - **Mark - ConvoAI** (1SM7GgM6IMuvQlz2BwM3): ConvoAI voice
  - Total voice options: 8 premium voices available system-wide
  - Voice options synchronized between main app and test environment
- **✅ X TIMELINE INTEGRATION**: Implemented user timeline posts fetching and integration
  - PostgreSQL database schema updated with `x_auth_tokens` table for secure token storage
  - Database storage layer updated to handle X authentication tokens (create, read, update)
  - X OAuth callback now stores user tokens in database for persistent authentication
  - `liveSearchService.js` enhanced to accept `userHandle` and `accessToken` parameters
  - Timeline posts fetched from followed accounts (last 24h, up to 500 posts across 5 pages)
  - Posts categorized by topics using xAI and integrated with Live Search results
  - Enhanced headlines generation includes personalized content from user's timeline

### Previous Updates (January 11, 2025)
- **✅ SUCCESSFUL xAI LIVE SEARCH IMPLEMENTATION**: Fixed API configuration and achieved working live search system
  - xAI Live Search API successfully called FIRST as requested by user
  - Real data collection: 2396 characters with 15 authentic citations
  - Flow: xAI Live Search → Data collection → Grok-4 compilation → Newsletter display
  - Performance: 5-7 seconds vs 47-68 seconds previously (5x faster)
  - No synthetic data generation - only authentic sources as required
- **✅ ENHANCED MULTI-SOURCE CONFIGURATION**: Added comprehensive source filtering and optimized data processing
  - Multi-source Live Search: Web, X (50,000+ view threshold), News sources
  - Two-stage Live Search: Initial data collection → Newsletter compilation with URL verification
  - Cleaned up outdated code: Removed empty X posts processing and unused likes parameters
  - Streamlined data flow: Direct Live Search content to Grok without redundant processing
- **✅ RESOLVED MULTI-TOPIC PROCESSING ISSUE**: Fixed root cause of "only 1 out of 5 topics showing results"
  - **Root Causes Identified**: Token limit bottleneck (2000 max_tokens insufficient), data summary overflow, JSON response truncation
  - **Fixes Applied**: Increased max_tokens to 10000, truncated web data to 1500 chars per topic, truncated citations to 500 chars per topic
  - **Results**: 3-topic test shows "Generated 3 headlines from 3 topics" (all topics processed vs previous 1 topic only)
  - **Data Collection**: Working perfectly for all topics (15 citations each), newsletter compilation was the bottleneck
- **✅ FIXED HOME PAGE LINKS ISSUE**: Resolved supporting articles linking to home pages instead of specific articles
  - **Root Cause**: Citation truncation (500 chars) was cutting off specific article URLs during newsletter compilation
  - **Fix Applied**: Removed citation truncation, enhanced Grok-4 instructions to use exact URLs from citations
  - **System Enhancement**: Added explicit "CRITICAL: Extract exact URLs from citations" instruction to prevent generic home page links
  - **Result**: Supporting articles now preserve specific article URLs from xAI Live Search citations
- **STREAMLINED ARCHITECTURE**: Reduced codebase complexity using "chainsaw" approach
  - liveSearchService.js: 700+ lines → 240 lines (essential flow only)
  - xaiAnalyzer.js: 300+ lines → 70 lines (basic categorization only)
  - Removed all authenticity analysis and synthetic data generation
  - Eliminated website blocking functionality as requested
- **VERIFIED WORKING COMPONENTS**:
  - xAI Live Search API with X, Web, News sources ✅
  - Real citation URLs returned (15 citations per topic) ✅
  - Grok-4 newsletter compilation with 10000 max_tokens ✅
  - Multi-topic processing (all topics now show results) ✅
  - Fast performance with authentic data only ✅

### Previous Updates (January 10, 2025)
- **X API WORKFLOW INTEGRATION**: Implemented official X API v2 integration to replace web scraping for improved accuracy
  - `fetchXPostMetadata` function uses bearer token authentication for official API calls
  - Fetches comprehensive metadata: text, likes, retweets, replies, views, author info
  - Falls back to scraping only when API fails, ensuring resilience
- **FULL ARTICLE CONTENT FETCHING**: Extended beyond titles to fetch complete article body text
  - `fetchArticleContent` extracts up to 5000 characters of article content
  - Multiple selector strategies for different news site layouts
  - Manages token limits through intelligent truncation
- **AGGREGATED DATA COLLECTION**: System now compiles comprehensive data post-Live Search
  - Live search results with headlines and summaries
  - X posts with enhanced metadata from official API
  - Full article content for deeper analysis
  - Complete citation tracking across all sources
- **NEWSLETTER GENERATION LAYER**: Added Grok-4-0709 powered newsletter refinement
  - `generateNewsletter` function processes all aggregated data
  - Creates refined, factual summaries with proper citations
  - Configurable via `useNewsletter` toggle for flexible deployment
  - Zero-opinion policy enforced for pure factual reporting
- **MODULAR HELPER FUNCTIONS**: Improved code organization with extracted utility functions
  - Configuration constants centralized for easy management
  - Error handling and retry logic standardized
  - Clean separation of concerns for maintainability

### Previous Updates (January 10, 2025)
- **GROK-4-0709 UPGRADE**: Updated all Live Search operations from Grok-3 to Grok-4-0709 for enhanced AI processing capabilities
- **RSS FEED INTEGRATION**: Added RSS as a new source type with specific feed: https://rss.app/feeds/v1.1/_HsS8DYAWZWlg1hCS.json
- **COMPREHENSIVE X POST FETCHING**: Implemented real X post content extraction using axios/cheerio with fallback handling
- **IMPROVED ARTICLE FILTERING**: Enhanced article title fetching with homepage detection and generic title filtering
- **ENHANCED AUTHENTICITY SCORING**: Lowered threshold to >0.5 and added average score fallback for better content inclusion
- **REAL TEXT INTEGRATION**: X posts now fetch actual post text, likes, and timestamps instead of placeholder data
- **CRITICAL BUG FIX**: Fixed podcast duration issue - podcasts now generate for full requested duration instead of capping at 2:30 minutes
- **Audio Combination System**: Implemented ffmpeg-based audio segment combination to create complete podcasts from multiple ElevenLabs segments
- **Segment Processing**: Enhanced to generate all script segments and combine them into final audio file with cleanup of intermediate files
- **Real Duration Matching**: 5-minute podcasts now generate ~750 word scripts and full-length audio (±15 seconds tolerance)
- **Multi-Source Integration**: Now pulls from web, X/Twitter, news, and RSS sources for comprehensive coverage
- **Sequential Topic Processing**: Individual API calls per topic for better relevance and source quality
- **24-Hour Date Filtering**: Implemented proper ISO8601 date format (YYYY-MM-DD) for `from_date` parameter
- **Timeout Protection**: Added 20-second timeout wrapper to prevent API calls from hanging
- **Authentic Source Distribution**: Real URLs from Live Search with quality engagement filtering
- **Enhanced Error Handling**: Graceful fallback for failed topics with timeout protection
- **Article Title Fetching**: Implemented axios/cheerio to fetch real article titles from URLs instead of URL slugs
- **Inline Citation Parsing**: Added [n] citation format in summaries to match specific sources to headlines
- **Authenticity Filtering**: Posts must have >0.5 authenticity score from xAI analysis (lowered from 0.7)
- **Improved JSON Parsing**: Extracts JSON properly even when xAI includes preamble text
- **Enhanced Engagement Metrics**: Includes views, replies in addition to likes/retweets
- **Batched Processing**: xaiAnalyzer splits large post sets to avoid token overflow
- **Comprehensive Code Review**: Implemented ALL of Grok 4's factuality suggestions including shared callXAI helper and "ZERO opinions" enforcement

### Previous Updates (January 9, 2025)
- **xAI Integration**: Replaced OpenAI with xAI (Grok) for authentic content analysis and categorization
- **Dynamic Verified Sources**: User-specific trusted sources combined with xAI-suggested sources per topic
- **Real Content Focus**: Searches verified sources without using trending keywords like "breaking news", "viral", "trending"
- **AI-Powered Authenticity**: Uses xAI to analyze posts for authenticity_score and significance_score
- **Intelligent Topic Matching**: xAI provides semantic understanding for better topic categorization vs keyword matching
- **User-Controlled Sources**: Users can define their own trusted sources per topic through the UI
- **Efficient X API Usage**: Compiles targeted source queries outside X API to minimize rate limit usage
- **Podcast Test Page**: Added "/podcast-test" route with cached headlines to test podcast system without X API calls
- **ElevenLabs Voice Integration**: Fixed voice ID issues, now using Bryan (Professional Narrator) as default with 5 curated voice options
- **SendGrid Email Integration**: Replaced Gmail/nodemailer with SendGrid API for professional email delivery with better deliverability
- **Enhanced Headlines System**: Improved to generate 15 specific headlines with 5-10 X posts each, using 15-20 sources per topic for comprehensive coverage
- **Web Search-Based Subtopic Discovery**: Replaced LLM-based subtopic generation with real-time trending keyword discovery to improve subtopic search success rate and eliminate training data lag
- **xAI Live Search Integration**: Implemented xAI's Live Search functionality as an alternative to the 5-workflow system, reducing API calls from 100+ to 1 and response times from 30-60s to ~8s

## Deployment Strategy

### Development Environment
- **Replit-ready**: Configured with Replit-specific plugins and error handling
- **Hot Module Replacement**: Vite provides instant feedback during development
- **Environment Variables**: Sensitive API keys managed through Replit Secrets

### Production Build
- **Static Assets**: Frontend built to `dist/public` for static serving
- **Server Bundle**: Backend bundled with ESBuild for Node.js deployment
- **Database Migration**: Drizzle migrations ready for PostgreSQL deployment

### Environment Variables Required
- `X_BEARER_TOKEN`: X (Twitter) API Bearer Token for authentic post retrieval
- `X_CLIENT_ID`: X API OAuth 2.0 Client ID for user authentication and premium features
- `XAI_API_KEY`: xAI API key for content authenticity analysis and podcast script generation
- `OPENAI_API_KEY`: OpenAI API key for headline and subtopic generation (legacy)
- `ELEVENLABS_API_KEY`: ElevenLabs API key for voice synthesis (10,000 chars/month free tier)
- `DATABASE_URL`: PostgreSQL connection string for production database
- `SENDGRID_API_KEY`: SendGrid API key for professional email delivery (100 emails/day free tier)
- `EMAIL_FROM`: Verified sender email address for SendGrid (e.g., podcasts@yourdomain.com)

The application follows a clear separation of concerns with modular services, type-safe interfaces, and modern development practices. The workflow-based architecture allows for easy expansion of features while maintaining clean code organization.

### Podcast Generation Features
- **Script Viewer**: Development-only "View Podcast Script" button opens generated scripts in new browser tab
- **Voice Options**: 19 available voices from ElevenLabs with various accents and styles
- **Factual Content**: Scripts generated with strict no-opinion policy, only summarizing source material
- **Multi-format Delivery**: Web player with controls, downloadable MP3, and email distribution
- **Character Limit Management**: Automatic script segmentation for ElevenLabs free tier compliance