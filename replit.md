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

### 2. Frontend Components
- **TopicInput**: Handles user input of 5+ topics with real-time validation
- **HeadlineCard**: Displays generated headlines with expandable source posts and articles
- **PodcastModal**: Configures podcast generation settings (planned feature)

### 3. API Integration Services
- **xSearch.js**: Interfaces with X API v2 for real-time post retrieval
- **headlineCreator.js**: OpenAI API integration for headline generation
- **supportCompiler.js**: Google News RSS parsing for supporting articles
- **completeSearch.js**: OpenAI API for subtopic generation

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
- **Authentic Content Discovery**: Removed keyword-based "viral" queries, now focuses on verified sources (Reuters, AP, BBC, government officials, tech leaders)
- **Real Content Focus**: Eliminates posts with keywords like "breaking news", "viral", "trending" to find genuine authentic posts
- **AI-Powered Authenticity**: Uses xAI to analyze posts for authenticity_score and significance_score
- **Intelligent Topic Matching**: xAI provides semantic understanding for better topic categorization vs keyword matching

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
- `XAI_API_KEY`: xAI API key for content authenticity analysis and intelligent categorization
- `OPENAI_API_KEY`: OpenAI API key for headline and subtopic generation (legacy)
- `DATABASE_URL`: PostgreSQL connection string for production database

The application follows a clear separation of concerns with modular services, type-safe interfaces, and modern development practices. The workflow-based architecture allows for easy expansion of features while maintaining clean code organization.