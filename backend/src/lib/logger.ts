/* eslint-disable @typescript-eslint/no-explicit-any */
import winston from 'winston';
import { config } from '../config';

// Sensitive fields that should be redacted from logs
const SENSITIVE_FIELDS = [
  'password',
  'passwordHash',
  'token',
  'accessToken',
  'refreshToken',
  'authorization',
  'secret',
  'apiKey',
  'apiSecret',
  'clientSecret',
  'jwtSecret',
  'privateKey',
];

/**
 * Recursively sanitize an object to remove sensitive data
 */
function sanitizeObject(obj: any, depth = 0): any {
  // Prevent infinite recursion
  if (depth > 10) {
    return '[Max depth reached]';
  }

  if (obj === null || obj === undefined) {
    return obj;
  }

  // Handle primitives
  if (typeof obj !== 'object') {
    return obj;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item, depth + 1));
  }

  // Handle objects
  const sanitized: any = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    
    // Check if this is a sensitive field
    if (SENSITIVE_FIELDS.some((field) => lowerKey.includes(field))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'string' && value.length > 1000) {
      // Truncate very long strings
      sanitized[key] = value.substring(0, 1000) + '...[truncated]';
    } else {
      sanitized[key] = sanitizeObject(value, depth + 1);
    }
  }

  return sanitized;
}

/**
 * Sanitize log message and metadata
 */
function sanitizeLogData(message: string, meta?: any): { message: string; meta?: any } {
  let sanitizedMessage = message;
  
  // Check if message contains sensitive patterns
  if (typeof message === 'string') {
    // Redact JWT tokens (Bearer tokens)
    sanitizedMessage = message.replace(/Bearer\s+[\w-]+\.[\w-]+\.[\w-]+/gi, 'Bearer [REDACTED]');
    // Redact other token patterns
    sanitizedMessage = sanitizedMessage.replace(/token['":\s]*[=:]\s*['"]?[\w-]+['"]?/gi, 'token=[REDACTED]');
    // Redact password patterns
    sanitizedMessage = sanitizedMessage.replace(/password['":\s]*[=:]\s*['"]?[^'"]+['"]?/gi, 'password=[REDACTED]');
  }

  const sanitizedMeta = meta ? sanitizeObject(meta) : undefined;

  return { message: sanitizedMessage, meta: sanitizedMeta };
}

// Create Winston logger instance
const logger = winston.createLogger({
  level: config.nodeEnv === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'isms-backend' },
  transports: [
    // Write all logs to console
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
          return `${timestamp} [${level}]: ${message} ${metaStr}`;
        })
      ),
    }),
  ],
});

// In production, also write to file
if (config.nodeEnv === 'production') {
  logger.add(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
    })
  );
  logger.add(
    new winston.transports.File({
      filename: 'logs/combined.log',
    })
  );
}

/**
 * Logger interface that sanitizes sensitive data
 */
export const log = {
  error: (message: string, meta?: any) => {
    const { message: sanitizedMessage, meta: sanitizedMeta } = sanitizeLogData(message, meta);
    logger.error(sanitizedMessage, sanitizedMeta);
  },
  warn: (message: string, meta?: any) => {
    const { message: sanitizedMessage, meta: sanitizedMeta } = sanitizeLogData(message, meta);
    logger.warn(sanitizedMessage, sanitizedMeta);
  },
  info: (message: string, meta?: any) => {
    const { message: sanitizedMessage, meta: sanitizedMeta } = sanitizeLogData(message, meta);
    logger.info(sanitizedMessage, sanitizedMeta);
  },
  debug: (message: string, meta?: any) => {
    const { message: sanitizedMessage, meta: sanitizedMeta } = sanitizeLogData(message, meta);
    logger.debug(sanitizedMessage, sanitizedMeta);
  },
  // For compatibility with console.log usage
  log: (message: string, meta?: any) => {
    const { message: sanitizedMessage, meta: sanitizedMeta } = sanitizeLogData(message, meta);
    logger.info(sanitizedMessage, sanitizedMeta);
  },
};

export default log;


