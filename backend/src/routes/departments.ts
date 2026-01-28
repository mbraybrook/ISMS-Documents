/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { randomUUID } from 'crypto';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import { requireRole } from '../middleware/authorize';
import { prisma } from '../lib/prisma';

const router = Router();

const validate = (req: any, res: Response, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const firstMsg = errors.array()[0]?.msg;
    return res.status(400).json({
      error: typeof firstMsg === 'string' ? firstMsg : 'Validation failed',
      errors: errors.array(),
    });
  }
  next();
};

// GET /api/departments - list all departments
// IMPORTANT: This route must come before /:id to avoid route matching conflicts
router.get(
  '/',
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const departments = await prisma.department.findMany({
        orderBy: { name: 'asc' },
        include: {
          _count: {
            select: {
              users: true,
              risks: true,
            },
          },
        },
      });

      res.json(departments);
    } catch (error) {
      console.error('Error fetching departments:', error);
      res.status(500).json({ error: 'Failed to fetch departments' });
    }
  }
);

// ID param: accept any non-empty string (trim + strip trailing slashes).
// Prisma returns 404 for unknown ids; strict UUID rejected legacy/non-UUID ids on some envs (e.g. EC2).
const idParam = () =>
  param('id')
    .trim()
    .customSanitizer((val: string) => (typeof val === 'string' ? val.replace(/\/+$/, '') : val))
    .notEmpty()
    .withMessage('Invalid department ID format');

// GET /api/departments/:id - get department details
router.get(
  '/:id',
  authenticateToken,
  [idParam()],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const department = await prisma.department.findUnique({
        where: { id: req.params.id },
        include: {
          _count: {
            select: {
              users: true,
              risks: true,
            },
          },
        },
      });

      if (!department) {
        return res.status(404).json({ error: 'Department not found' });
      }

      res.json(department);
    } catch (error) {
      console.error('Error fetching department:', error);
      res.status(500).json({ error: 'Failed to fetch department' });
    }
  }
);

// POST /api/departments - create department (admin only)
router.post(
  '/',
  authenticateToken,
  requireRole('ADMIN'),
  [
    body('name').notEmpty().trim().withMessage('Name is required'),
  ],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const department = await prisma.department.create({
        data: {
          id: randomUUID(),
          name: req.body.name,
        },
      });

      res.status(201).json(department);
    } catch (error: any) {
      if (error.code === 'P2002') {
        return res.status(409).json({ error: 'Department name already exists' });
      }
      console.error('Error creating department:', error);
      res.status(500).json({ error: 'Failed to create department' });
    }
  }
);

// PUT /api/departments/:id - update department (admin only)
router.put(
  '/:id',
  authenticateToken,
  requireRole('ADMIN'),
  [idParam(), body('name').notEmpty().trim().withMessage('Name is required')],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const id = String(req.params.id).trim();
      const department = await prisma.department.update({
        where: { id },
        data: {
          name: req.body.name,
        },
      });

      res.json(department);
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Department not found' });
      }
      if (error.code === 'P2002') {
        return res.status(409).json({ error: 'Department name already exists' });
      }
      console.error('Error updating department:', error);
      res.status(500).json({ error: 'Failed to update department' });
    }
  }
);

// DELETE /api/departments/:id - delete department (admin only)
router.delete(
  '/:id',
  authenticateToken,
  requireRole('ADMIN'),
  [idParam()],
  validate,
  async (req: AuthRequest, res: Response) => {
    try {
      const id = String(req.params.id).trim();
      // Check if department is used by any users
      const userCount = await prisma.user.count({
        where: { departmentId: id },
      });

      // Check if department is used by any risks
      const riskCount = await prisma.risk.count({
        where: { departmentId: id },
      });

      if (userCount > 0 || riskCount > 0) {
        const reasons: string[] = [];
        if (userCount > 0) {
          reasons.push(`${userCount} user(s)`);
        }
        if (riskCount > 0) {
          reasons.push(`${riskCount} risk(s)`);
        }
        return res.status(409).json({
          error: `Cannot delete department: it is assigned to ${reasons.join(' and ')}`,
        });
      }

      await prisma.department.delete({
        where: { id },
      });

      res.status(204).send();
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Department not found' });
      }
      console.error('Error deleting department:', error);
      res.status(500).json({ error: 'Failed to delete department' });
    }
  }
);

export default router;
