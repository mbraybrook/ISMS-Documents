import { Router, Response } from 'express';
import { query, validationResult } from 'express-validator';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import { prisma } from '../lib/prisma';

const router = Router();

const validate = (req: any, res: Response, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// GET /api/users - list users (for dropdowns, etc.)
router.get(
  '/',
  authenticateToken,
  [
    query('role').optional().isIn(['ADMIN', 'EDITOR', 'STAFF']),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { role } = req.query;

      const where: any = {};
      if (role) {
        // Handle both single role and array of roles
        const roles = Array.isArray(role) ? role : [role];
        if (roles.length > 0) {
          where.role = { in: roles };
        }
      }

      const users = await prisma.user.findMany({
        where,
        select: {
          id: true,
          displayName: true,
          email: true,
          role: true,
        },
        orderBy: {
          displayName: 'asc',
        },
      });

      res.json({ data: users });
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  }
);

export { router as usersRouter };

