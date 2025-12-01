import { Router, Response } from 'express';
import { query, param, body, validationResult } from 'express-validator';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import { requireRole } from '../middleware/authorize';
import { prisma } from '../lib/prisma';
import { Department, UserRole } from '../types/enums';

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
  requireRole('ADMIN', 'EDITOR'),
  [
    query('role').optional().isIn(['ADMIN', 'EDITOR', 'STAFF', 'CONTRIBUTOR']),
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
          department: true,
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

// PUT /api/users/:id - update user (role and department) - Admin only
router.put(
  '/:id',
  authenticateToken,
  requireRole('ADMIN'),
  [
    param('id').isUUID(),
    body('role').optional().isIn(['ADMIN', 'EDITOR', 'STAFF', 'CONTRIBUTOR']),
    body('department').optional().isIn(['BUSINESS_STRATEGY', 'FINANCE', 'HR', 'OPERATIONS', 'PRODUCT', 'MARKETING', null]),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { role, department } = req.body;

      // Check if user exists
      const existingUser = await prisma.user.findUnique({
        where: { id },
      });

      if (!existingUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Prepare update data
      const updateData: any = {
        updatedAt: new Date(),
      };

      if (role !== undefined) {
        updateData.role = role;
      }

      if (department !== undefined) {
        // Allow null to clear department
        updateData.department = department === null ? null : department;
      }

      // Update user
      const updatedUser = await prisma.user.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          displayName: true,
          email: true,
          role: true,
          department: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      res.json(updatedUser);
    } catch (error) {
      console.error('Error updating user:', error);
      res.status(500).json({ error: 'Failed to update user' });
    }
  }
);

export { router as usersRouter };

