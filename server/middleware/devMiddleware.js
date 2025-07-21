// server/middleware/devMiddleware.js

// Keep track of database readiness
let isDatabaseReady = false;

// Set database ready flag (called from db.ts)
export function setDatabaseReady(ready) {
  isDatabaseReady = ready;
  if (ready) {
    console.log('✅ Database ready for dev auto-login');
  }
}

// Middleware to auto-authenticate in development mode
export async function devAutoLogin(req, res, next) {
  // Only apply in development
  if (process.env.NODE_ENV !== 'development') {
    return next();
  }
  
  // Skip non-API routes to avoid unnecessary database calls
  if (!req.path.startsWith('/api/')) {
    return next();
  }
  
  // Skip if database isn't ready yet
  if (!isDatabaseReady) {
    return next();
  }
  
  // Skip if already authenticated
  if (req.session?.userId) {
    return next();
  }
  
  // Auto-login as default dev user - find by username instead of ID
  const DEV_USERNAME = 'dev_user';
  
  try {
    const { storage } = await import('../storage.js');
    const user = await storage.getUserByUsername(DEV_USERNAME);
    
    if (user) {
      // Set session values
      req.session.userId = user.id;
      req.session.username = user.username;
      req.user = user;
      
      // Check if user has X auth
      const xAuth = await storage.getXAuthTokenByUserId(user.id);
      if (xAuth) {
        req.session.xAuthenticated = true;
        req.session.xHandle = xAuth.xHandle;
      }
      
      console.log(`🔧 Dev auto-login successful: ${user.username} (userId: ${user.id})`);
      
      // Save session and wait for it to complete
      await new Promise((resolve, reject) => {
        req.session.save((err) => {
          if (err) {
            console.error('Failed to save session:', err);
            reject(err);
          } else {
            resolve();
          }
        });
      });
    } else {
      console.log('❌ Dev user not found in database');
    }
  } catch (error) {
    console.error('❌ Dev auto-login failed:', error.message);
  }
  
  next();
}

// Middleware to ensure development-only routes
export function devOnly(req, res, next) {
  if (process.env.NODE_ENV !== 'development') {
    return res.status(404).json({ 
      error: 'Development endpoints not available in production' 
    });
  }
  next();
}

// Add development environment info to response headers
export function addDevHeaders(req, res, next) {
  if (process.env.NODE_ENV === 'development') {
    res.setHeader('X-Environment', 'development');
    res.setHeader('X-Dev-Mode', 'true');
  }
  next();
}