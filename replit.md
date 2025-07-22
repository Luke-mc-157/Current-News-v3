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

## Recent Updates (July 21, 2025 - 9:51 PM UTC)

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