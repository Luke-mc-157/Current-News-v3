// server/middleware/devMiddleware.js

// Middleware to auto-authenticate in development mode
export async function devAutoLogin(req, res, next) {
  // Only apply in development
  if (process.env.NODE_ENV !== 'development') {
    return next();
  }
  
  // Skip if already authenticated
  if (req.user || req.session?.userId) {
    return next();
  }
  
  // Auto-login as default dev user (ID: 1)
  const DEV_USER_ID = 1;
  
  try {
    const { storage } = await import('../storage.js');
    const user = await storage.getUser(DEV_USER_ID);
    
    if (user) {
      req.user = user;
      req.session.userId = user.id;
      req.session.username = user.username;
      
      // Check if user has X auth
      const xAuth = await storage.getXAuthTokenByUserId(user.id);
      if (xAuth) {
        req.session.xAuthenticated = true;
        req.session.xHandle = xAuth.xHandle;
      }
      
      console.log(`🔧 Dev auto-login: ${user.username}`);
    }
  } catch (error) {
    console.log('Dev auto-login failed:', error.message);
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