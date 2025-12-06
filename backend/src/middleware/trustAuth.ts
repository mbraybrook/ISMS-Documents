import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { prisma } from '../lib/prisma';
import { log } from '../lib/logger';

// Minimum length for JWT secret (32 characters recommended for HS256)
const MIN_JWT_SECRET_LENGTH = 32;

/**
 * Validates that JWT secret is configured and meets security requirements
 */
function validateJwtSecret(secret: string | undefined): { valid: boolean; error?: string } {
  if (!secret) {
    return { valid: false, error: 'JWT secret not configured' };
  }
  
  if (typeof secret !== 'string') {
    return { valid: false, error: 'JWT secret must be a string' };
  }
  
  if (secret.trim().length === 0) {
    return { valid: false, error: 'JWT secret cannot be empty' };
  }
  
  if (secret.length < MIN_JWT_SECRET_LENGTH) {
    return { 
      valid: false, 
      error: `JWT secret must be at least ${MIN_JWT_SECRET_LENGTH} characters long for security` 
    };
  }
  
  return { valid: true };
}

export interface TrustAuthRequest extends Request {
  externalUser?: {
    id: string;
    email: string;
    companyName: string;
    isApproved: boolean;
    tokenVersion: number;
    termsAcceptedAt: Date | null;
  };
}

export const authenticateTrustToken = async (
  req: TrustAuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);

    const secretValidation = validateJwtSecret(config.trustCenter.jwtSecret);
    if (!secretValidation.valid) {
      log.error('[TRUST_AUTH] JWT secret validation failed', { error: secretValidation.error });
      return res.status(500).json({ error: 'Authentication configuration error' });
    }

    // Verify token
    let decoded: any;
    try {
      decoded = jwt.verify(token, config.trustCenter.jwtSecret);
    } catch (err: any) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expired' });
      }
      if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({ error: 'Invalid token' });
      }
      throw err;
    }

    if (!decoded || typeof decoded !== 'object' || !decoded.userId) {
      return res.status(401).json({ error: 'Invalid token payload' });
    }

    // Fetch user from database
    const externalUser = await prisma.externalUser.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        companyName: true,
        isApproved: true,
        tokenVersion: true,
        termsAcceptedAt: true,
      },
    });

    if (!externalUser) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Check if user is approved
    if (!externalUser.isApproved) {
      return res.status(403).json({ error: 'User not approved' });
    }

    // Check token version (for invalidation on password change)
    if (decoded.tokenVersion !== undefined && decoded.tokenVersion !== externalUser.tokenVersion) {
      return res.status(401).json({ error: 'Token invalidated' });
    }

    // Attach user to request
    req.externalUser = externalUser;

    next();
  } catch (error) {
    log.error('[TRUST_AUTH] Authentication error', { error: error instanceof Error ? error.message : String(error) });
    return res.status(500).json({ error: 'Authentication error' });
  }
};


