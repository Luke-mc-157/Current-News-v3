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
- **Script Generation**: Uses xAI Grok-2-1212 to create factual podcast scripts
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
- **xAI API**: Grok-2-1212 model for content authenticity analysis and intelligent topic categorization
- **OpenAI API**: GPT-3.5-turbo and GPT-4 for headline and subtopic generation (legacy)
- **Google News RSS**: Public RSS feeds for supporting article discovery
- **Neon Database**: Serverless PostgreSQL for production data storage

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

### Latest Updates (January 9, 2025)
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