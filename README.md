# Current - AI-Powered News Aggregation Platform

An intelligent news aggregation application that transforms real-time social media content into personalized podcasts using AI-driven content compilation and multi-source information synthesis.

## Features

- **Real-time X (Twitter) Integration**: Fetches authentic posts using X API v2
- **AI-Powered Headlines**: Generates compelling news headlines using OpenAI
- **Google News Integration**: Compiles supporting articles from Google News RSS feeds
- **Personalized Topics**: Users can input 5+ topics of interest
- **Podcast Settings**: Configure AI-generated podcast preferences
- **Modern UI**: Built with React, TypeScript, and shadcn/ui components
- **Real-time Updates**: Live data from authenticated sources only

## Technology Stack

### Frontend
- **React 18** with TypeScript
- **Wouter** for client-side routing
- **TanStack Query** for server state management
- **shadcn/ui** components built on Radix UI
- **Tailwind CSS** for styling
- **Vite** for build tooling

### Backend
- **Node.js** with Express.js
- **TypeScript** with ES modules
- **PostgreSQL** with Drizzle ORM
- **Neon Database** (serverless PostgreSQL)
- **Real API Integrations**: X API v2, OpenAI, Google News RSS

## API Integrations

- **X API v2**: Real-time tweet search and engagement data
- **OpenAI API**: Headline generation and topic expansion
- **Google News RSS**: Supporting article compilation
- **Neon Database**: PostgreSQL for data persistence

## Prerequisites

- Node.js 18+ 
- PostgreSQL database (or Neon Database account)
- API Keys:
  - `X_BEARER_TOKEN` - X (Twitter) API Bearer Token
  - `OPENAI_API_KEY` - OpenAI API Key
  - `DATABASE_URL` - PostgreSQL connection string

## Getting Started

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd current-news-aggregator
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file or set environment variables:
   ```
   DATABASE_URL=your_postgresql_connection_string
   X_BEARER_TOKEN=your_x_api_bearer_token
   OPENAI_API_KEY=your_openai_api_key
   ```

4. **Set up the database**
   ```bash
   npm run db:push
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to `http://localhost:5000`

## Usage

1. **Enter Topics**: Input 5 or more topics you're interested in (comma-separated)
2. **Generate Headlines**: Click "Generate Headlines" to create personalized news
3. **View Results**: Browse headlines with source posts and supporting articles
4. **Configure Podcasts**: Set up podcast generation preferences (optional)

## Project Structure

```
├── client/              # React frontend
│   ├── src/
│   │   ├── components/  # UI components
│   │   ├── pages/       # Application pages
│   │   └── lib/         # Utilities and query client
├── server/              # Express backend
│   ├── services/        # API integration services
│   ├── workflows/       # Business logic workflows
│   └── storage.ts       # Database operations
├── shared/              # Shared types and schemas
└── README.md
```

## Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run check` - TypeScript type checking
- `npm run db:push` - Deploy database schema changes

## Data Sources

This application uses only authentic data sources:

- **X Posts**: Real tweets fetched via X API v2
- **News Articles**: Genuine articles from Google News RSS feeds
- **Headlines**: AI-generated based on real social media content
- **No Mock Data**: All content comes from verified, real-time sources

## API Endpoints

- `POST /api/generate-headlines` - Generate headlines from topics
- `GET /api/headlines` - Retrieve generated headlines
- `POST /api/podcast-settings` - Save podcast preferences

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Security

- API keys are stored securely as environment variables
- All external API calls are authenticated
- No user data is stored without consent
- Real-time data fetching with proper rate limiting

## Support

For issues, questions, or feature requests, please open an issue on GitHub.