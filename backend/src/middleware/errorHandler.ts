import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { log } from '../lib/logger';

export interface AppError extends Error {
  statusCode?: number;
}

export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  log.error('Error occurred', { 
    message: err.message, 
    stack: err.stack,
    statusCode,
    path: req.path,
    method: req.method,
  });

  // Never expose stack traces in production
  // Only include stack trace in development mode
  const isDevelopment = config.nodeEnv === 'development' || process.env.NODE_ENV === 'development';
  const isProduction = config.nodeEnv === 'production' || process.env.NODE_ENV === 'production';

  res.status(statusCode).json({
    error: {
      message,
      // Explicitly check for development and ensure production never exposes stack
      ...(isDevelopment && !isProduction && err.stack ? { stack: err.stack } : {}),
    },
  });
};

