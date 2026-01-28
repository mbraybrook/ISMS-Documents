/* eslint-disable @typescript-eslint/no-explicit-any */
import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { UserRole } from '../types/enums';
import { prisma } from '../lib/prisma';
import { log } from '../lib/logger';

export const requireRole = (...allowedRoles: UserRole[]) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const user = await prisma.user.findUnique({
        where: { email: req.user.email },
        include: {
          department: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      if (!user) {
        return res.status(403).json({ error: 'User not found' });
      }

      // Cast role to UserRole type (validated at database level)
      const userRole = user.role as UserRole;
      if (!allowedRoles.includes(userRole)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      // Attach user object with role and department to request
      // Support both departmentId (new) and department name (legacy)
      const userDepartment = (user as any).department?.name || (user as any).department || null;
      const userDepartmentId = (user as any).departmentId || null;
      req.user = { ...req.user, role: user.role, department: userDepartment, departmentId: userDepartmentId } as any;
      next();
    } catch (error) {
      log.error('Authorization error', { error: error instanceof Error ? error.message : String(error) });
      return res.status(500).json({ error: 'Authorization error' });
    }
  };
};

/**
 * Middleware to ensure Contributors can only access risks from their department
 * This is enforced at the route level by filtering queries
 */
export const requireDepartmentAccess = () => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const user = await prisma.user.findUnique({
        where: { email: req.user.email },
        include: {
          department: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      if (!user) {
        return res.status(403).json({ error: 'User not found' });
      }

      // For Contributors, ensure they have a department assigned
      if (user.role === 'CONTRIBUTOR' && !user.department) {
        return res.status(403).json({ error: 'Contributors must have a department assigned' });
      }

      // Attach user department to request for filtering
      req.user = { ...req.user, role: user.role, department: user.department } as any;
      next();
    } catch (error) {
      log.error('Department access error', { error: error instanceof Error ? error.message : String(error) });
      return res.status(500).json({ error: 'Department access error' });
    }
  };
};

