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
  keyGenerator: (req) => {
    const userId = (req as any).externalUser?.id || (req as any).user?.id;
    return userId ? `${req.ip}-${userId}` : req.ip;
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
  keyGenerator: (req) => {
    const email = (req.body as any)?.email;
    return email ? `${req.ip}-${email}` : req.ip;
  },
});

