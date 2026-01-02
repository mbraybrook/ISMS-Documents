import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to authenticate internal service requests
 * Validates X-Internal-Service-Token header
 */
export function authInternal(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers['x-internal-service-token'] as string;
  const expectedToken = process.env.INTERNAL_SERVICE_TOKEN;

  if (!expectedToken) {
    console.error('[AuthInternal] INTERNAL_SERVICE_TOKEN not configured');
    res.status(500).json({
      error: 'Service misconfiguration',
      code: 'INTERNAL_TOKEN_NOT_CONFIGURED',
    });
    return;
  }

  if (!token || token !== expectedToken) {
    console.warn('[AuthInternal] Invalid or missing token');
    res.status(401).json({
      error: 'unauthorized',
      code: 'INTERNAL_TOKEN_INVALID',
    });
    return;
  }

  next();
}




