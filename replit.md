# Current - AI-Powered News Aggregation Platform

## Overview
Current is an intelligent news aggregation application that transforms real-time social media content into personalized news summaries. It fetches authentic posts from X (Twitter), generates headlines using OpenAI, and compiles supporting articles from Google News RSS feeds, all powered by AI-driven content compilation and multi-source information synthesis. The project aims to provide fast, real-time, and personalized news delivery, including automated podcast generation and delivery.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter
- **State Management**: TanStack Query
- **UI Components**: shadcn/ui (built on Radix UI)
- **Styling**: Tailwind CSS with CSS variables for theming
- **Build Tool**: Vite

### Backend
- **Framework**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **Architecture**: Modular service architecture
- **Database**: PostgreSQL with Drizzle ORM (for production)

### Data Storage
- **Production Database**: PostgreSQL (Neon Database for serverless deployment)
- **ORM**: Drizzle ORM (type-safe)
- **Schema**: Supports users, topics, headlines, podcast settings, scheduled podcasts, and RSS feeds.

### Key Features
- **xAI Live Search System**: Fully parallel processing for both xAI API calls and article fetching, integrating web, X, news, and RSS sources for real-time data and ultra-fast responses (5-7 seconds total regardless of topic or article count). Includes X timeline integration for personalized content.
- **RSS Feed Integration System**: Allows users to add/remove RSS feeds, which are automatically integrated into xAI Live Search for enhanced content compilation.
- **Podcast Generation System**: Fetches full text from X posts and article URLs, uses xAI Grok-4-0709 for factual script generation, integrates ElevenLabs API for voice synthesis, and offers web player/email distribution. Supports duration and voice selection.
- **Automated Podcast Delivery System**: Comprehensive scheduling with user preferences (topics, duration, voice, delivery times, timezone), 7-day rolling schedule, and automated processing (headline generation → script creation → audio synthesis → email delivery). Uses stateless delivery system with no retry mechanisms to prevent duplicate API consumption.
- **Security & Reliability**: Includes robust session security, development isolation, payload compression, graceful shutdown, global error handling, and enhanced database retry logic.

### Technical Implementations
- **Modular Services**: `liveSearchService.js`, `xAuth.js`, `xTimeline.js`, `xaiAnalyzer.js`, `contentFetcher.js`, `podcastGenerator.js`, `voiceSynthesis.js`, `emailService.js`, `podcastScheduler.js` (stateless design with no overdue processing).
- **Data Flow**: User input topics initiate backend workflow. xAI Live Search fetches and compiles content. xAI generates newsletters/headlines. Optional podcast generation with voice synthesis. Delivery via download, email, or scheduled automation.
- **Timezone Handling**: Consistent timezone handling throughout the podcast scheduling pipeline using `date-fns` and `date-fns-tz`.
- **X Token Refresh**: Automatic X authentication token refresh to maintain persistent user authentication.

## External Dependencies

### APIs and Services
- **X API v2**: For real-time tweet search and user timeline access (OAuth 2.0).
- **xAI API**: Grok-4-0709 for Live Search, content analysis, and script generation.
- **ElevenLabs API**: For high-quality voice synthesis in podcast generation.
- **SendGrid API**: For professional email delivery of podcasts.
- **Neon Database**: Serverless PostgreSQL for production data storage.

### Development Tools
- **Drizzle Kit**: For database migrations and schema management.
- **ESBuild**: For fast JavaScript bundling.
- **PostCSS**: For CSS processing, integrated with Tailwind CSS.

### Environment Variables
- `X_BEARER_TOKEN`
- `X_CLIENT_ID`
- `X_CLIENT_SECRET`
- `XAI_API_KEY`
- `ELEVENLABS_API_KEY`
- `DATABASE_URL`
- `SENDGRID_API_KEY`
- `EMAIL_FROM`