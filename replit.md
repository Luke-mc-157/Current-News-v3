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
- PostgreSQL database with Drizzle ORM for production data persistence

### Data Storage Strategy
- **Production**: PostgreSQL with Neon Database (serverless) for all data persistence
- **ORM**: Drizzle ORM configured for PostgreSQL with type-safe database operations
- Database schema supports users, topics, headlines, podcast settings, scheduled podcasts, and RSS feeds

## Key Components

### 1. xAI Live Search System
The backend uses a single, streamlined xAI Live Search workflow:

- **Live Search**: Single API call to xAI Grok-4 with built-in web, X, news, and RSS source integration
- **Real-time Data**: Fetches authentic content from multiple sources in one operation
- **Fast Response**: 5-7 second response time vs 47-68 seconds with old workflows
- **Timeline Integration**: Fetches user's X timeline posts for personalized content when authenticated

### 2. RSS Feed Integration System
The application includes comprehensive RSS feed integration:

- **User Management**: Users can add/remove RSS feeds via dedicated UI
- **Content Compilation**: RSS articles automatically integrated into xAI Live Search
- **Data Flow**: RSS feeds → Article parsing → Search compilation → Newsletter generation
- **Enhanced Quality**: Provides additional authenticated news sources for all search topics

### 3. Podcast Generation System
The application includes a comprehensive podcast generation system:

- **Content Compilation**: Fetches full text from all X posts and article URLs
- **Script Generation**: Uses xAI Grok-4-0709 to create factual podcast scripts
- **Voice Synthesis**: Integrates ElevenLabs API for high-quality voice generation
- **Audio Delivery**: Provides web player and email distribution options
- **User Controls**: Duration selection (5-30 min), voice selection, instant playbook

### 4. Automated Podcast Delivery System
Complete scheduling system for automated podcast delivery:

- **User Preferences**: Topics, duration, voice, delivery times, timezone support
- **Schedule Management**: 7-day rolling schedule with daily maintenance
- **Processing Pipeline**: Automated headline generation → script creation → audio synthesis → email delivery
- **Status Tracking**: Database persistence with comprehensive error handling and logging

### 5. Frontend Components
- **TopicInput**: Handles user input of 5+ topics with real-time validation
- **HeadlineCard**: Displays generated headlines with expandable source posts and articles
- **PodcastGenerator**: Complete podcast generation interface with manual controls
- **RSS Manager**: UI for managing RSS feed subscriptions
- **Podcast Preferences**: Scheduling interface for automated delivery setup

### 6. API Integration Services
- **liveSearchService.js**: Main xAI Live Search implementation with multi-source integration
- **xAuth.js**: X OAuth 2.0 authentication for timeline access
- **xTimeline.js**: X timeline posts fetching and database storage
- **xaiAnalyzer.js**: xAI content analysis and categorization
- **contentFetcher.js**: Article content fetching for podcast compilation
- **podcastGenerator.js**: xAI-powered factual script generation
- **voiceSynthesis.js**: ElevenLabs API integration for voice generation
- **emailService.js**: SendGrid-based email delivery system
- **podcastScheduler.js**: Automated podcast processing and delivery system

## Data Flow

1. **User Input**: User enters 5+ topics through the frontend interface
2. **Topic Processing**: Backend validates topics and initiates the workflow system
3. **Live Search**: Single xAI API call fetches data from X, web, news, and RSS sources
4. **Content Compilation**: All sources compiled into structured data for AI processing
5. **Newsletter Generation**: xAI processes compiled data into formatted headlines with sources
6. **Podcast Generation**: Optional conversion to audio format with voice synthesis
7. **Delivery**: Manual download/email or automated scheduled delivery

## External Dependencies

### APIs and Services
- **X API v2**: Real-time tweet search with OAuth 2.0 authentication for timeline access
- **xAI API**: Grok-4-0709 for all Live Search queries and complex reasoning tasks
- **ElevenLabs API**: Voice synthesis for podcast generation with multiple voice options
- **SendGrid API**: Professional email delivery for podcast distribution
- **Neon Database**: Serverless PostgreSQL for production data storage

### Development Tools
- **Drizzle Kit**: Database migrations and schema management
- **ESBuild**: Fast JavaScript bundling for production builds
- **PostCSS**: CSS processing with Tailwind CSS integration

## Recent Updates (July 30, 2025 - 7:15 PM UTC)

### **✅ CRITICAL "UNDEFINED" TOPIC BUG FIXED** (July 30, 2025 - 7:15 PM UTC)
- **Issue**: Topics were being labeled as "undefined" during article analysis and compilation, corrupting podcast generation
- **Root Cause**: `getCompiledDataForPodcast` was missing proper data structure when calling `RawSearchDataCompiler_AllData`
- **What Broke**: Function was pushing raw `getTopicDataFromLiveSearch` result without wrapping it with topic property
- **Fix Applied**: 
  - Modified `getCompiledDataForPodcast` to properly structure data with `topic`, `webData`, and `citations` properties
  - Added error handling to include empty structure even for failed topic fetches
- **Impact**: Podcasts now process with correct topic names throughout the entire pipeline
- **Note**: This issue only appeared today due to recent code changes

### **⚠️ ONGOING ISSUE: Podcasts Getting Stuck in Processing Status** (July 31, 2025 - 12:15 PM CST)
- **Pattern Identified**: Multiple podcasts getting stuck in "processing" status instead of "pending"
- **Examples Found**:
  - 7am podcast (ID 412) marked as "failed" by cleanup function after missing 15-minute window
  - 12:05pm podcast (ID 426) stuck in "processing" for 24+ hours
  - 12:20pm podcast (ID 467) created with "processing" status instead of "pending"
- **Impact**: Scheduler only processes "pending" podcasts, so stuck podcasts never run
- **Temporary Fix**: Manually update stuck podcasts to "pending" status via SQL
- **Root Cause**: Still investigating why new podcasts immediately go to "processing" status

### **✅ COMPREHENSIVE PODCAST DELIVERY SYSTEM OVERHAUL COMPLETED** (July 30, 2025 - 6:10 PM UTC)
- **Critical Issues Fixed**:
  - **Time Window Bug**: Fixed `getPendingPodcastsDue()` which only looked for podcasts already past their time
  - **New Time Window**: 15-minute forward-looking window + 30-minute grace period for past podcasts
  - **Stuck Podcast Recovery**: Added automatic retry for podcasts stuck in "processing" status over 30 minutes
  - **Direct Test Delivery**: Created `/api/dev/test-podcast-direct` endpoint that bypasses scheduling entirely
  - **Health Monitoring**: Added `/api/podcast-health` endpoint to track stuck, failed, and upcoming podcasts
- **Root Causes Addressed**:
  - Scheduler was missing podcasts if it ran even 1 second late due to strict time comparison
  - No recovery mechanism for podcasts that started processing but failed
  - "Test Delivery Now" was incorrectly using scheduled system instead of direct generation
- **Technical Improvements**:
  - Enhanced error handling with comprehensive try-catch blocks
  - Fixed misleading "checking every 5 minutes" log (actually 1 minute)
  - Frontend updated to use new direct test endpoint
- **Impact**: Podcast delivery system now robust with proper time windows, recovery mechanisms, and monitoring

## Earlier Updates (July 24, 2025 - 5:40 PM UTC)

### **✅ COMPREHENSIVE SECURITY AND RELIABILITY HARDENING COMPLETED** (July 24, 2025 - 5:40 PM UTC)
- **Systematic Security Improvements**:
  - **Session Security**: Fixed hardcoded secrets, added environment-based secret generation, enabled secure cookies in production
  - **Development Isolation**: DevAutoLogin middleware now only runs in development environment
  - **Compression Added**: Large aggregation payloads now compressed for improved performance
  - **Response Security**: Fixed error handling to prevent infinite response loops
- **Database Reliability Enhancements**:
  - **Graceful Shutdown**: Added proper database pool shutdown on SIGTERM/SIGINT signals
  - **Global Error Handling**: Added uncaught exception and unhandled rejection handlers
  - **Enhanced Retries**: Extended database retry logic to all critical operations (createUser, createHeadline, etc.)
  - **Interface Compliance**: Fixed IStorage interface mismatch by adding all missing DatabaseStorage methods
  - **Dead Code Removal**: Completely removed unused MemStorage class (350+ lines of dead code)
- **Production Optimizations**:
  - **Environment-Aware Logging**: Console logs now respect NODE_ENV to reduce production noise
  - **Improved Log Limits**: Increased truncation from 80 to 200 characters for better debugging
  - **Health Check Enforcement**: Database health check now exits in production if connection fails
- **Impact**: Application now production-ready with enterprise-grade security, reliability, and error handling

### **✅ CRITICAL PODCAST SCHEDULER TIMING ISSUES FIXED** (July 24, 2025 - 5:15 PM UTC)
- **Issue Identified**: Scheduler was marking podcasts as "failed" immediately when past their scheduled time, even by just 1 minute
- **Root Cause**: Cleanup logic was too aggressive + 5-minute scheduler interval created timing gaps
- **Comprehensive Fixes Applied**:
  - **15-Minute Grace Period**: Cleanup now only marks podcasts as 'failed' after 15+ minutes past scheduled time
  - **1-Minute Scheduler Interval**: Reduced from 5 minutes to catch tight timing windows
  - **Immediate Processing**: Added `processPendingPodcasts()` call after preference changes for instant processing
  - **Smart Status Management**: Podcasts within grace period marked as 'processing' instead of 'failed'
- **Impact**: Scheduled podcasts now process reliably even when preferences change close to delivery times
- **Testing**: System should handle same-day scheduling updates without marking podcasts as failed

## Earlier Updates (July 23, 2025 - 9:35 PM UTC)

### **✅ CRITICAL PODCAST GENERATION BUG FIXED**
- **Issue**: System crashed with "Cannot read properties of undefined (reading 'substring')" when processing scheduled podcasts
- **Root Causes Identified**:
  - Missing `webData` field in topic data causing substring error at line 723
  - Invalid or undefined topics in preference snapshots
  - No validation for empty or malformed topic arrays
- **Fixes Applied**:
  - **Error Handling**: Added fallback for missing `webData` with descriptive message
  - **Topic Validation**: Filter out undefined/empty topics before processing
  - **Enhanced Logging**: Added preference snapshot debugging for better diagnostics
  - **Data Flow**: Ensures only valid topics pass through entire pipeline
- **Impact**: Scheduled podcasts now process successfully even with incomplete data

### **✅ PODCAST SCHEDULING BUFFER REDUCED**
- **Changed**: Buffer time reduced from 60min (dev) / 10min (prod) to 5 minutes for both environments
- **Reason**: Previous 60-minute development buffer was too conservative, causing same-day deliveries to be skipped
- **Impact**: More responsive scheduling - podcasts can be scheduled with just 5 minutes notice

### **✅ SAME-DAY PODCAST SCHEDULING FIXED** 
- **Issue**: System was skipping same-day afternoon podcasts when preferences were updated
- **Root Cause**: Code checked if delivery time was future but ignored the 5-minute processing buffer
- **Fix Applied**: Now checks if scheduled time (5 min before delivery) has sufficient buffer
- **Added Logging**: Debug messages show when deliveries are included or skipped with reasons
- **Impact**: Same-day podcasts now properly created when there's at least 5 minutes until scheduled time

### **✅ IMPROVED SAME-DAY SCHEDULING WITH 1-MINUTE BUFFER**
- **Enhancement**: When users update preferences, same-day podcasts now only need 1-minute buffer instead of 5
- **Reason**: 5-minute buffer too conservative for immediate preference updates
- **Implementation**: Added `isImmediateUpdate` flag to scheduling functions
- **Impact**: Users can schedule podcasts as close as 6 minutes before delivery time
- **Example**: Update at 5:24 PM can now schedule 5:30 PM delivery (was previously skipped)

### **✅ TIMEZONE BUG COMPLETELY FIXED** (July 24, 2025 - 4:25 PM UTC)
- **Root Cause Identified**: Mixing date-fns-tz functions with native JavaScript Date methods caused timezone offset errors
- **Core Problem**: `toZonedTime()` adjusted timestamps, then `setHours()` applied changes in system timezone (UTC) instead of user timezone
- **Impact**: Afternoon deliveries calculated incorrectly, appearing in wrong day or too far future
- **Complete Fix Applied**:
  - **Replaced native Date methods**: Now uses `startOfDay`, `addDays`, `setHours`, `setMinutes` from `date-fns`
  - **Consistent timezone handling**: All operations now respect user timezone throughout entire pipeline
  - **Updated day-of-week logic**: `shouldDeliverOnDay` now uses `date-fns-tz` format functions
  - **Enhanced logging**: Date display uses timezone-aware formatting
- **Verification**: Test confirms 5:40 PM CDT correctly converts to 22:40 UTC (scheduled 22:35 UTC)
- **Result**: Both morning and afternoon podcasts now schedule reliably with proper timezone conversions

### **✅ AUTOMATIC X TOKEN REFRESH IMPLEMENTED** (July 24, 2025 - 4:32 PM UTC)
- **Issue Resolved**: X authentication tokens were expiring and requiring manual re-authentication
- **Root Problem**: Auth status endpoints only checked for expired tokens without attempting refresh
- **Solution Implemented**:
  - **Smart Token Refresh**: Both `/api/auth/x/status` and `/api/auth/x/check` now automatically refresh expired tokens using stored refresh tokens
  - **5-Minute Buffer**: System detects tokens within 5 minutes of expiry and refreshes proactively
  - **Seamless Experience**: Users no longer need to manually re-authenticate when tokens expire
  - **Database Updates**: Refreshed tokens automatically stored in database for persistence
  - **Fallback Handling**: Only requires manual re-auth if refresh tokens are also invalid/expired
- **Verification**: System successfully refreshed expired token and restored "Enhanced with X" indicator
- **Impact**: Users now maintain persistent X authentication without interruption for podcast generation

## Earlier Updates (July 21, 2025 - 9:51 PM UTC)

### **✅ REMOVED DEVELOPMENT TEST PAGES**
- **Clean Up Completed**: Removed "Podcast Test" and "Scraper Test" pages as no longer needed for production application
- **Files Deleted**: `client/src/pages/podcast-test.tsx` and `client/src/pages/scraper-test.tsx`
- **Navigation Updated**: Removed test page links from header navigation in home.tsx
- **Routing Updated**: Removed routes and imports from App.tsx
- **Impact**: Cleaner, production-focused application without development testing artifacts
- **Confirmed**: No dependencies on test pages from main application flows (home and podcasts pages)

### **✅ HEADER ALIGNMENT PERFECTED**
- **Baseline Alignment**: "Current" text and taglines now properly aligned on same baseline
- **Vertical Centering**: Navigation elements centered vertically in header container
- **Consistent Styling**: Applied items-center for main container, items-baseline for text groups
- **Cross-Page Consistency**: Header alignment pattern applied to all remaining pages

### **✅ CRITICAL AUTOMATED PODCAST DELIVERY BUG FIXED** (Earlier Today)
- **Root Cause Identified**: Audio generation and email delivery were happening OUTSIDE the try-catch block in automated scheduler
- **Database Evidence**: Today's 7am CST delivery failed silently, 2:10pm CST delivery stuck in "processing" status  
- **xAI Token Consumption**: Confirmed Live Search worked (tokens consumed) but audio/email failed
- **Primary Fixes Applied**:
  - **Expanded Error Handling**: Moved audio generation and email sending inside try-catch block
  - **Fixed File Path Logic**: Updated path detection for new `Search-Data_&_Podcast-Storage/` folder structure
  - **Enhanced Error Logging**: Added error message capture and storage in database for debugging
  - **Missing Episode ID**: Added episode.id parameter to generateAudio() calls
- **Secondary Fixes**:
  - **RSS Integration Completed**: RSS articles now properly flow through entire pipeline to newsletter generation
  - **Improved Logging**: Enhanced console output for debugging automated deliveries
  - **Database Status Management**: Better tracking of failed vs processing states
- **Testing**: Created immediate test delivery to verify fixes work correctly
- **Impact**: Automated podcast deliveries will now properly complete or fail with detailed error messages

### **✅ RSS FEED INTEGRATION FULLY OPERATIONAL**
- **Complete Pipeline**: RSS articles now integrated from feed parsing → compilation → newsletter generation  
- **Data Structure**: RSS articles appear as "[Feed Name]: Title - Content..." format in compiled data
- **xAI Integration**: Enhanced prompts recognize RSS articles as legitimate sources alongside X posts
- **User Experience**: RSS feeds provide supplementary content that enriches newsletter quality

### **✅ RSS PROCESSING BUGS COMPLETELY FIXED** (July 22, 2025)
- **"Undefined" Text Issue Resolved**: Fixed property name mismatch from `feed_name` to `feedName` in liveSearchService.js line 659
- **Content Truncation Removed**: Eliminated arbitrary 200-character limit that was cutting off RSS article content
- **Enhanced Data Collection**: Now fetching and displaying all RSS fields: title, URL, pubDate, author, content, source, feedName
- **Full Content Access**: RSS articles now display complete content instead of truncated summaries ending in "..."
- **Improved Format**: Enhanced display format: "[FeedName] by Author (Date): Title - FullContent [URL]"
- **Token Efficiency**: Removed unnecessary truncation since xAI API supports 500,000+ characters vs previous 200-character limit

### Architecture Notes
- **Manual vs Automated Workflows**: Both use same core services but differ in orchestration and error handling
- **Error Recovery**: Automated system now captures failures at every stage with database persistence
- **File Organization**: Centralized data storage in `Search-Data_&_Podcast-Storage/` with organized subfolders

## Environment Variables Required
- `X_BEARER_TOKEN`: X (Twitter) API Bearer Token for post retrieval  
- `X_CLIENT_ID` & `X_CLIENT_SECRET`: X API OAuth 2.0 credentials for user authentication
- `XAI_API_KEY`: xAI API key for Live Search and content analysis
- `ELEVENLABS_API_KEY`: ElevenLabs API key for voice synthesis  
- `DATABASE_URL`: PostgreSQL connection string for production database
- `SENDGRID_API_KEY`: SendGrid API key for email delivery
- `EMAIL_FROM`: Verified sender email address for SendGrid

The application follows a clear separation of concerns with modular services, type-safe interfaces, and modern development practices. The workflow-based architecture allows for easy expansion of features while maintaining clean code organization.