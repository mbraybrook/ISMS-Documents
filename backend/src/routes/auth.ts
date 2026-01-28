/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router, Response } from 'express';
import { randomUUID } from 'crypto';
import { User } from '@prisma/client';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { retryDbOperation } from '../lib/dbRetry';
import { config } from '../config';

const router = Router();

// Sync/create user from token
router.post('/sync', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { email, name, oid } = req.user;

    // Log if email is missing for debugging
    if (!email) {
      console.warn('[AUTH] No email found in token payload, will use fallback:', {
        user: req.user,
        availableFields: Object.keys(req.user || {}),
      });
    }

    // Validate email domain (defense-in-depth, also checked in middleware)
    const allowedDomain = config.auth.allowedEmailDomain.toLowerCase();
    if (email) {
      const emailDomain = email.split('@')[1]?.toLowerCase();
      if (!emailDomain || emailDomain !== allowedDomain) {
        console.error('[AUTH] Email domain validation failed in sync endpoint:', {
          email,
          emailDomain,
          allowedDomain,
        });
        return res.status(403).json({
          error: `Access restricted to @${allowedDomain} email addresses`,
        });
      }
    } else {
      // If email is missing, reject the request
      return res.status(403).json({
        error: 'Email address is required for authentication',
      });
    }

    // Find user by email or by Entra ID (for cases where email might have changed)
    // Use retry logic for database operations to handle transient connection errors
    let user: User | null = await retryDbOperation(() =>
      prisma.user.findUnique({
        where: { email: email },
        include: {
          department: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      })
    );

    // Also try to find by Entra ID if not found by email
    if (!user && oid) {
      user = await retryDbOperation(() =>
        prisma.user.findFirst({
          where: { entraObjectId: oid },
          include: {
            department: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        })
      );
    }

    if (!user) {
      // First non-system user becomes admin, others default to STAFF
      // Check if there are any ADMIN users (excluding system user)
      const adminCount = await retryDbOperation(() =>
        prisma.user.count({
          where: {
            role: 'ADMIN',
            id: { not: '00000000-0000-0000-0000-000000000000' }, // Exclude system user
          },
        })
      );
      const role = adminCount === 0 ? 'ADMIN' : 'STAFF';

      // Ensure we have an email - if not, log a warning
      if (!email) {
        console.warn('[AUTH] Creating user without email address. Token fields:', {
          hasEmail: !!req.user.email,
          hasPreferredUsername: !!req.user.email,
          sub: req.user.sub,
          oid: req.user.oid,
        });
      }

      // Generate a UUID for the user ID (required in PostgreSQL)
      const userId = randomUUID();

      user = await retryDbOperation(() =>
        prisma.user.create({
          data: {
            id: userId,
            email: email || `user-${req.user?.sub || 'unknown'}@unknown.local`, // Fallback email if none provided
            displayName: name || email || 'Unknown User',
            entraObjectId: oid || req.user?.sub || 'unknown',
            role: role as any,
            updatedAt: new Date(),
          },
        })
      );
    } else {
      // Update user info if changed, including email if it was missing before
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      const updateData: {
        displayName: string;
        entraObjectId: string;
        email?: string;
      } = {
        displayName: name || user.displayName,
        entraObjectId: oid || req.user?.sub || 'unknown',
      };
      
      // Update email if it was missing or is different (and new one is valid)
      if (email && (!user.email || user.email.includes('@unknown.local'))) {
        updateData.email = email;
        console.log('[AUTH] Updating user email from', user.email, 'to', email);
      }
      
      // Use retry logic for the update operation that was timing out
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      const userId = user.id;
      user = await retryDbOperation(
        () =>
          prisma.user.update({
            where: { id: userId },
            data: updateData,
          }),
        {
          maxRetries: 5, // More retries for update operations
          initialDelayMs: 200, // Start with slightly longer delay
          maxDelayMs: 3000, // Allow up to 3 seconds between retries
        }
      );
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
    });
  } catch (error) {
    console.error('Error syncing user:', error);
    res.status(500).json({ error: 'Failed to sync user' });
  }
});

// Get current user profile
router.get('/me', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await retryDbOperation(() =>
      prisma.user.findUnique({
        where: { email: req.user?.email || '' },
        select: {
          id: true,
          email: true,
          displayName: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
      })
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

export { router as authRouter };

