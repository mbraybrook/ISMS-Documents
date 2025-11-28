import { Router, Response } from 'express';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { retryDbOperation } from '../lib/dbRetry';

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

    // Find user by email or by Entra ID (for cases where email might have changed)
    // Use retry logic for database operations to handle transient connection errors
    let user = await retryDbOperation(() =>
      prisma.user.findUnique({
        where: { email: email },
      })
    );

    // Also try to find by Entra ID if not found by email
    if (!user && oid) {
      user = await retryDbOperation(() =>
        prisma.user.findFirst({
          where: { entraObjectId: oid },
        })
      );
    }

    if (!user) {
      // First user becomes admin, others default to STAFF
      const userCount = await retryDbOperation(() => prisma.user.count());
      const role = userCount === 0 ? 'ADMIN' : 'STAFF';

      // Ensure we have an email - if not, log a warning
      if (!email) {
        console.warn('[AUTH] Creating user without email address. Token fields:', {
          hasEmail: !!req.user.email,
          hasPreferredUsername: !!req.user.email,
          sub: req.user.sub,
          oid: req.user.oid,
        });
      }

      user = await retryDbOperation(() =>
        prisma.user.create({
          data: {
            email: email || `user-${req.user.sub}@unknown.local`, // Fallback email if none provided
            displayName: name || email || 'Unknown User',
            entraObjectId: oid || req.user.sub,
            role: role as any,
          },
        })
      );
    } else {
      // Update user info if changed, including email if it was missing before
      const updateData: any = {
        displayName: name || user.displayName,
        entraObjectId: oid || req.user.sub,
      };
      
      // Update email if it was missing or is different (and new one is valid)
      if (email && (!user.email || user.email.includes('@unknown.local'))) {
        updateData.email = email;
        console.log('[AUTH] Updating user email from', user.email, 'to', email);
      }
      
      // Use retry logic for the update operation that was timing out
      user = await retryDbOperation(
        () =>
          prisma.user.update({
            where: { id: user.id },
            data: updateData,
          }),
        {
          maxRetries: 5, // More retries for update operations
          initialDelayMs: 200, // Start with slightly longer delay
          maxDelayMs: 3000, // Allow up to 3 seconds between retries
        }
      );
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
        where: { email: req.user.email || '' },
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

