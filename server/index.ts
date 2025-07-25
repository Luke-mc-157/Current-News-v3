import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import compression from "compression";
import crypto from "crypto";
import path from "path";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { devAutoLogin } from "./middleware/devMiddleware.js";
import { startPodcastScheduler } from "./services/podcastScheduler.js";

const app = express();
app.use(compression()); // Add compression for large aggregations
app.use(express.json({ limit: '10mb' })); // Increased from default 100kb to handle large compiled data
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// Add session management for persistent authentication
app.use(session({
  secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'), // Auto-generate if missing
  resave: false,
  saveUninitialized: process.env.NODE_ENV === 'development', // Only true in development
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 1 day instead of 7
    sameSite: 'strict'
  },
  rolling: true // Reset expiry on each request
}));

// Add development auto-login middleware (only in development)
if (process.env.NODE_ENV === 'development') {
  app.use(devAutoLogin);
}

// Serve podcast audio files BEFORE Vite middleware to prevent conflicts
app.use('/Search-Data_&_Podcast-Storage/podcast-audio', express.static(path.join(process.cwd(), 'Search-Data_&_Podcast-Storage', 'podcast-audio')));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 200) {
        logLine = logLine.slice(0, 199) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    // Don't throw err after responding - prevents response loop issues
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
    
    // Start podcast scheduler after server is running
    startPodcastScheduler();
  });
})();
