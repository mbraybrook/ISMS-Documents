/* eslint-disable @typescript-eslint/no-explicit-any */
import rateLimit from 'express-rate-limit';

// Login rate limiter: 5 attempts per 15 minutes per IP
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: 'Too many login attempts from this IP, please try again after 15 minutes.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Register rate limiter: 3 attempts per hour per IP
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 requests per window
  message: 'Too many registration attempts from this IP, please try again after 1 hour.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Download rate limiter: 20 downloads per hour per user
export const downloadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 requests per window
  message: 'Too many download requests, please try again after 1 hour.',
  standardHeaders: true,
  legacyHeaders: false,
  // Use a key generator that includes user ID if available
  keyGenerator: (req): string => {
    const userId = (req as any).externalUser?.id || (req as any).user?.id;
    const ip = req.ip || 'unknown';
    return userId ? `${ip}-${userId}` : ip;
  },
});

// Password reset rate limiter: 3 requests per hour per email
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 requests per window
  message: 'Too many password reset requests, please try again after 1 hour.',
  standardHeaders: true,
  legacyHeaders: false,
  // Use email from request body if available
  keyGenerator: (req): string => {
    const email = (req.body as any)?.email;
    const ip = req.ip || 'unknown';
    return email ? `${ip}-${email}` : ip;
  },
});

// Global rate limiter for all API routes
// This provides basic DoS protection while allowing legitimate traffic
// Specific routes (like login) have stricter limits applied on top of this
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 2000, // 2000 requests per 15 minutes per IP (~133 requests/minute)
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for health check and auth sync endpoints
  // Auth sync is authenticated and called frequently during normal app usage
  skip: (req) => {
    return req.path === '/api/health' || req.path === '/api/auth/sync';
  },
});


