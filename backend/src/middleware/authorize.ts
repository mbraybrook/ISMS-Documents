import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { UserRole } from '../types/enums';
import { prisma } from '../lib/prisma';

export const requireRole = (...allowedRoles: UserRole[]) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const user = await prisma.user.findUnique({
        where: { email: req.user.email },
      });

      if (!user) {
        return res.status(403).json({ error: 'User not found' });
      }

      // Cast role to UserRole type (validated at database level)
      const userRole = user.role as UserRole;
      if (!allowedRoles.includes(userRole)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      // Attach user object with role to request
      req.user = { ...req.user, role: user.role } as any;
      next();
    } catch (error) {
      console.error('Authorization error:', error);
      return res.status(500).json({ error: 'Authorization error' });
    }
  };
};

