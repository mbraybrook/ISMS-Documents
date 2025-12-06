import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../../lib/prisma';
import { config } from '../../config';
import { loginLimiter, registerLimiter, passwordResetLimiter } from '../../middleware/rateLimit';
import { logTrustAction } from '../../services/trustAuditService';
import { authenticateTrustToken, TrustAuthRequest } from '../../middleware/trustAuth';
import { log } from '../../lib/logger';

const router = Router();

// Helper to get IP address from request
const getIpAddress = (req: any): string => {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
    req.socket.remoteAddress ||
    'unknown'
  );
};

// Helper to validate password strength
const validatePassword = (password: string): { valid: boolean; message?: string } => {
  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters long' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one uppercase letter' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one lowercase letter' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one number' };
  }
  return { valid: true };
};

// POST /api/trust/register
router.post(
  '/register',
  registerLimiter,
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isString().isLength({ min: 8 }),
    body('companyName').isString().trim().notEmpty(),
  ],
  async (req: any, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password, companyName } = req.body;

      // Validate password strength
      const passwordValidation = validatePassword(password);
      if (!passwordValidation.valid) {
        return res.status(400).json({ error: passwordValidation.message });
      }

      // Check if email already exists
      const existingUser = await prisma.externalUser.findUnique({
        where: { email },
      });

      if (existingUser) {
        return res.status(400).json({ error: 'Email already registered' });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Create user
      const user = await prisma.externalUser.create({
        data: {
          email,
          passwordHash,
          companyName,
          isApproved: false,
        },
        select: {
          id: true,
          email: true,
          companyName: true,
          isApproved: true,
          createdAt: true,
        },
      });

      // Log registration
      await logTrustAction('USER_REGISTERED', undefined, user.id, undefined, undefined, { companyName }, getIpAddress(req));

      res.status(201).json({
        id: user.id,
        email: user.email,
        companyName: user.companyName,
        isApproved: user.isApproved,
        message: 'Registration successful. Awaiting approval.',
      });
    } catch (error: any) {
      log.error('[TRUST_AUTH] Registration error', { error: error.message || String(error) });
      res.status(500).json({ error: 'Failed to register user' });
    }
  }
);

// POST /api/trust/login
router.post(
  '/login',
  loginLimiter,
  [body('email').isEmail().normalizeEmail(), body('password').isString().notEmpty()],
  async (req: any, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password } = req.body;

      // Find user
      const user = await prisma.externalUser.findUnique({
        where: { email },
      });

      if (!user) {
        // Log failed login attempt
        await logTrustAction('LOGIN_FAILED', undefined, undefined, undefined, undefined, { email, reason: 'User not found' }, getIpAddress(req));
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      // Verify password
      const passwordValid = await bcrypt.compare(password, user.passwordHash);
      if (!passwordValid) {
        // Log failed login attempt
        await logTrustAction('LOGIN_FAILED', undefined, user.id, undefined, undefined, { email, reason: 'Invalid password' }, getIpAddress(req));
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      // Check if user is approved
      if (!user.isApproved) {
        return res.status(403).json({ error: 'Account pending approval' });
      }

      // Generate JWT token
      // Validate JWT secret
      const jwtSecretValue = config.trustCenter.jwtSecret;
      if (!jwtSecretValue || typeof jwtSecretValue !== 'string' || jwtSecretValue.trim().length === 0) {
        return res.status(500).json({ error: 'JWT secret not configured' });
      }
      if (jwtSecretValue.length < 32) {
        return res.status(500).json({ error: 'JWT secret must be at least 32 characters long for security' });
      }

      const jwtSecret = String(jwtSecretValue);
      const jwtExpiry = String(config.trustCenter.jwtExpiry);
      const token = jwt.sign(
        {
          userId: user.id,
          email: user.email,
          tokenVersion: user.tokenVersion,
        },
        jwtSecret,
        {
          expiresIn: jwtExpiry,
        }
      );

      // Log successful login
      await logTrustAction('LOGIN_SUCCESS', undefined, user.id, undefined, undefined, { email }, getIpAddress(req));

      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          companyName: user.companyName,
          isApproved: user.isApproved,
          termsAcceptedAt: user.termsAcceptedAt,
        },
      });
    } catch (error: any) {
      log.error('[TRUST_AUTH] Login error', { error: error.message || String(error) });
      res.status(500).json({ error: 'Failed to login' });
    }
  }
);

// POST /api/trust/logout
router.post('/logout', async (req: any, res: Response) => {
  try {
    // Token invalidation is handled by incrementing tokenVersion on password change
    // For logout, we just return success (client should discard token)
    res.json({ message: 'Logged out successfully' });
  } catch (error: any) {
    log.error('[TRUST_AUTH] Logout error', { error: error.message || String(error) });
    res.status(500).json({ error: 'Failed to logout' });
  }
});

// POST /api/trust/forgot-password
router.post(
  '/forgot-password',
  passwordResetLimiter,
  [body('email').isEmail().normalizeEmail()],
  async (req: any, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email } = req.body;

      // Find user
      const user = await prisma.externalUser.findUnique({
        where: { email },
      });

      // Don't reveal if email exists (security best practice)
      // Always return success message
      if (user) {
        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetExpires = new Date();
        resetExpires.setHours(resetExpires.getHours() + 1); // 1 hour expiry

        // Save reset token
        await prisma.externalUser.update({
          where: { id: user.id },
          data: {
            passwordResetToken: resetToken,
            passwordResetExpires: resetExpires,
          },
        });

        // TODO: Send email with reset link
        // For now, just log it (in production, send email)
        log.info('[TRUST_AUTH] Password reset token generated', {
          email: user.email,
          // In production, don't log the token
        });

        // Log password reset request
        await logTrustAction('PASSWORD_RESET_REQUESTED', undefined, user.id, undefined, undefined, { email }, getIpAddress(req));
      }

      // Always return same message (don't reveal if email exists)
      res.json({
        message: 'If the email exists, a password reset link has been sent.',
      });
    } catch (error: any) {
      log.error('[TRUST_AUTH] Forgot password error', { error: error.message || String(error) });
      res.status(500).json({ error: 'Failed to process password reset request' });
    }
  }
);

// POST /api/trust/reset-password
router.post(
  '/reset-password',
  [
    body('token').isString().notEmpty(),
    body('newPassword').isString().isLength({ min: 8 }),
  ],
  async (req: any, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { token, newPassword } = req.body;

      // Validate password strength
      const passwordValidation = validatePassword(newPassword);
      if (!passwordValidation.valid) {
        return res.status(400).json({ error: passwordValidation.message });
      }

      // Find user with valid reset token
      const user = await prisma.externalUser.findFirst({
        where: {
          passwordResetToken: token,
          passwordResetExpires: {
            gt: new Date(), // Token not expired
          },
        },
      });

      if (!user) {
        return res.status(400).json({ error: 'Invalid or expired reset token' });
      }

      // Hash new password
      const passwordHash = await bcrypt.hash(newPassword, 10);

      // Update password and invalidate all tokens
      await prisma.externalUser.update({
        where: { id: user.id },
        data: {
          passwordHash,
          passwordResetToken: null,
          passwordResetExpires: null,
          tokenVersion: user.tokenVersion + 1, // Invalidate all existing tokens
        },
      });

      // Log password reset
      await logTrustAction('PASSWORD_RESET', undefined, user.id, undefined, undefined, { email: user.email }, getIpAddress(req));

      res.json({ message: 'Password reset successfully' });
    } catch (error: any) {
      log.error('[TRUST_AUTH] Reset password error', { error: error.message || String(error) });
      res.status(500).json({ error: 'Failed to reset password' });
    }
  }
);

// GET /api/trust/me
router.get('/me', authenticateTrustToken, async (req: TrustAuthRequest, res: Response) => {
  try {
    // This endpoint requires authentication via trustAuth middleware
    // The user will be attached to req.externalUser by the middleware
    const user = req.externalUser;

    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    res.json({
      id: user.id,
      email: user.email,
      companyName: user.companyName,
      isApproved: user.isApproved,
      termsAcceptedAt: user.termsAcceptedAt,
    });
  } catch (error: any) {
    log.error('[TRUST_AUTH] Get me error', { error: error.message || String(error) });
    res.status(500).json({ error: 'Failed to get user profile' });
  }
});

export { router as trustAuthRouter };

