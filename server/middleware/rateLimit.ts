import { Request, Response, NextFunction } from 'express';

// Simple in-memory rate limiting store
const requestStore = new Map<string, { count: number; resetTime: number }>();

interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  message?: string; // Custom error message
}

export const createRateLimit = (options: RateLimitOptions) => {
  const { windowMs, maxRequests, message = "Too many requests, please try again later" } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    // Use IP address as identifier.
    // req.ip works correctly when app.set('trust proxy', 1) is set in index.ts.
    const identifier = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    
    // Get or create rate limit record for this identifier
    let record = requestStore.get(identifier);
    
    if (!record || now > record.resetTime) {
      // Create new record or reset expired one
      record = {
        count: 1,
        resetTime: now + windowMs
      };
      requestStore.set(identifier, record);
      return next();
    }
    
    // Increment request count
    record.count++;
    
    // Check if limit exceeded
    if (record.count > maxRequests) {
      // Calculate time until reset
      const resetTimeSeconds = Math.ceil((record.resetTime - now) / 1000);
      
      return res.status(429).json({
        message,
        retryAfter: resetTimeSeconds
      });
    }
    
    // Update record
    requestStore.set(identifier, record);
    next();
  };
};

// Clean up expired records periodically (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  const keysToDelete: string[] = [];
  
  requestStore.forEach((record, key) => {
    if (now > record.resetTime) {
      keysToDelete.push(key);
    }
  });
  
  keysToDelete.forEach(key => requestStore.delete(key));
}, 5 * 60 * 1000);

// Predefined rate limiters for different use cases
export const adminRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 500, // 500 requests per 15 minutes (admin panels are request-heavy)
  message: "Admin rate limit exceeded. Please try again later."
});

export const sensitiveRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes  
  maxRequests: 20, // 20 requests per 15 minutes for sensitive operations
  message: "Too many sensitive operations. Please try again later."
});

export const authRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 10, // 10 requests per 15 minutes for auth operations
  message: "Too many authentication attempts. Please try again later."
});
