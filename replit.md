# Current - AI-Powered News Aggregation Platform

## Overview

Current is a news aggregation application that creates AI-generated podcasts from real-time news content. The platform allows users to input topics of interest and receive personalized news headlines with supporting information. Users can also configure podcast generation settings to receive AI-generated audio content based on their preferences.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack Query (React Query) for server state management
- **UI Framework**: shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens
- **Build Tool**: Vite with React plugin and custom error overlay

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **Database**: PostgreSQL with Drizzle ORM
- **Database Provider**: Neon Database (serverless PostgreSQL)
- **Session Management**: PostgreSQL-based sessions with connect-pg-simple
- **API Design**: RESTful endpoints with JSON responses

### Data Storage Solutions
- **Primary Database**: PostgreSQL hosted on Neon
- **ORM**: Drizzle ORM with TypeScript-first schema definitions
- **Migration Strategy**: Drizzle Kit for schema migrations
- **Fallback Storage**: In-memory storage implementation for development

## Key Components

### Database Schema
- **Users Table**: User authentication and profile data
- **User Topics Table**: JSON-based storage of user interest topics
- **Headlines Table**: Generated news headlines with metadata, source posts, and supporting articles
- **Podcast Settings Table**: User preferences for podcast generation (frequency, timing, voice, etc.)

### API Endpoints
- `POST /api/generate-headlines`: Creates personalized headlines based on user topics (minimum 5 topics required)
- `GET /api/headlines`: Retrieves all generated headlines
- `POST /api/podcast-settings`: Saves user podcast generation preferences

### Frontend Components
- **TopicInput**: Comma-separated topic input with real-time parsing and validation
- **HeadlineCard**: Expandable cards displaying headlines with source posts and supporting articles
- **PodcastModal**: Configuration interface for podcast generation settings
- **Toast System**: User feedback for actions and errors

## Data Flow

1. **Topic Submission**: Users enter 5+ topics via comma-separated input
2. **Headline Generation**: Backend processes topics and generates realistic news headlines with metadata
3. **Content Display**: Headlines are presented in expandable cards with engagement metrics and sources
4. **Podcast Configuration**: Users can configure podcast delivery preferences (frequency, timing, voice, etc.)
5. **Data Persistence**: All user preferences and generated content are stored in PostgreSQL

## External Dependencies

### UI and Styling
- **Radix UI**: Accessible component primitives
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide React**: Icon library
- **class-variance-authority**: Type-safe variant generation
- **clsx**: Conditional className utility

### Data Management
- **TanStack React Query**: Server state management with caching
- **React Hook Form**: Form state and validation
- **Zod**: Runtime type validation and schema definition
- **date-fns**: Date manipulation utilities

### Database and Backend
- **Drizzle ORM**: Type-safe database operations
- **Neon Database**: Serverless PostgreSQL provider
- **Express.js**: Web application framework
- **tsx**: TypeScript execution for development

## Deployment Strategy

### Development Environment
- **Dev Server**: Vite development server with HMR
- **Backend**: tsx for TypeScript execution with file watching
- **Database**: Neon Database with environment-based connection

### Production Build
- **Frontend**: Vite production build to `dist/public`
- **Backend**: esbuild bundling with Node.js platform targeting
- **Database Migrations**: Drizzle Kit push for schema updates
- **Environment Variables**: `DATABASE_URL` required for database connection

### Build Commands
- `npm run dev`: Development with file watching
- `npm run build`: Production build for both frontend and backend
- `npm run start`: Production server execution
- `npm run db:push`: Database schema deployment

## Changelog

Changelog:
- July 08, 2025. Initial setup

## User Preferences

Preferred communication style: Simple, everyday language.