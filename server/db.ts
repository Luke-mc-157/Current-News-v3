import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

// Configure Neon for better connectivity
neonConfig.webSocketConstructor = ws;
neonConfig.poolQueryViaFetch = true;
neonConfig.fetchConnectionCache = true;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Enhanced connection pool configuration with timeouts and retry logic
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  // Connection pool settings
  max: 10, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 10000, // Wait 10 seconds for connection
  // Query timeout
  query_timeout: 30000, // 30 second query timeout
  // Connection retry settings
  allowExitOnIdle: true,
});

export const db = drizzle({ client: pool, schema });

// Connection health check function
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    console.log('🔍 Checking database health...');
    const result = await pool.query('SELECT 1 as health_check');
    console.log('✅ Database health check passed');
    return true;
  } catch (error) {
    console.error('❌ Database health check failed:', error.message);
    return false;
  }
}

// Retry wrapper for database operations
export async function retryDatabaseOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      console.warn(`🔄 Database operation failed (attempt ${attempt}/${maxRetries}):`, error.message);
      
      // Don't retry on the last attempt
      if (attempt === maxRetries) {
        break;
      }
      
      // Exponential backoff delay
      const delay = baseDelay * Math.pow(2, attempt - 1);
      console.log(`⏳ Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw new Error(`Database operation failed after ${maxRetries} attempts: ${lastError.message}`);
}

// Initialize database connection with health check
async function initializeDatabase() {
  try {
    console.log('🚀 Initializing database connection...');
    const isHealthy = await checkDatabaseHealth();
    if (isHealthy) {
      console.log('✅ Database connection established successfully');
      
      // Notify dev middleware that database is ready
      if (process.env.NODE_ENV === 'development') {
        const { setDatabaseReady } = await import('./middleware/devMiddleware.js');
        setDatabaseReady(true);
      }
    } else {
      console.warn('⚠️ Database connection established but health check failed');
    }
  } catch (error) {
    console.error('❌ Failed to initialize database connection:', error.message);
  }
}

// Run initialization
initializeDatabase();
