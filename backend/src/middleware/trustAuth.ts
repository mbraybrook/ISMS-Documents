import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { prisma } from '../lib/prisma';

export interface TrustAuthRequest extends Request {
  externalUser?: {
    id: string;
    email: string;
    companyName: string;
    isApproved: boolean;
    tokenVersion: number;
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

    if (!config.trustCenter.jwtSecret) {
      console.error('[TRUST_AUTH] JWT secret not configured');
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
    console.error('[TRUST_AUTH] Authentication error:', error);
    return res.status(500).json({ error: 'Authentication error' });
  }
};


