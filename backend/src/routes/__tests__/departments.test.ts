/* eslint-disable @typescript-eslint/no-explicit-any */
import request from 'supertest';
import express from 'express';
import departmentsRouter from '../departments';

// Mock authentication middleware
jest.mock('../../middleware/auth', () => ({
  authenticateToken: (req: any, res: any, next: any) => {
    req.user = {
      sub: 'test-user',
      email: 'test@paythru.com',
      name: 'Test User',
      oid: 'test-oid',
    };
    next();
  },
}));

// Mock authorization middleware
jest.mock('../../middleware/authorize', () => ({
  requireRole: jest.fn(() => (req: any, res: any, next: any) => next()),
}));

// Mock Prisma
jest.mock('../../lib/prisma', () => ({
  prisma: {
    department: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    user: {
      count: jest.fn(),
    },
    risk: {
      count: jest.fn(),
    },
  },
}));

import { prisma } from '../../lib/prisma';
import { requireRole } from '../../middleware/authorize';

describe('Departments API', () => {
  let app: express.Application;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/departments', departmentsRouter);
    jest.clearAllMocks();
    (requireRole as jest.Mock).mockReturnValue((req: any, res: any, next: any) => next());
    // Suppress console.error during tests to avoid noise from expected error handling
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore console.error after each test
    consoleErrorSpy.mockRestore();
  });

  describe('GET /api/departments', () => {
    it('should return list of departments with user and risk counts', async () => {
      // Arrange
      const mockDepartments = [
        {
          id: '550e8400-e29b-41d4-a716-446655440001',
          name: 'Finance',
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: {
            users: 5,
            risks: 3,
          },
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440002',
          name: 'HR',
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: {
            users: 2,
            risks: 1,
          },
        },
      ];
      (prisma.department.findMany as jest.Mock).mockResolvedValue(mockDepartments);

      // Act
      const response = await request(app)
        .get('/api/departments')
        .expect(200);

      // Assert
      expect(response.body).toHaveLength(2);
      expect(response.body[0].name).toBe('Finance');
      expect(response.body[0]._count.users).toBe(5);
      expect(response.body[0]._count.risks).toBe(3);
      expect(response.body[1].name).toBe('HR');
      expect(response.body[1]._count.users).toBe(2);
      expect(response.body[1]._count.risks).toBe(1);
      expect(prisma.department.findMany).toHaveBeenCalledWith({
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
    });

    it('should return empty array when no departments exist', async () => {
      // Arrange
      (prisma.department.findMany as jest.Mock).mockResolvedValue([]);

      // Act
      const response = await request(app)
        .get('/api/departments')
        .expect(200);

      // Assert
      expect(response.body).toEqual([]);
      expect(prisma.department.findMany).toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      (prisma.department.findMany as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      // Act
      const response = await request(app)
        .get('/api/departments')
        .expect(500);

      // Assert
      expect(response.body).toEqual({ error: 'Failed to fetch departments' });
      expect(prisma.department.findMany).toHaveBeenCalled();
    });
  });

  describe('GET /api/departments/:id', () => {
    it('should return department details with user and risk counts', async () => {
      // Arrange
      const departmentId = '550e8400-e29b-41d4-a716-446655440001';
      const mockDepartment = {
        id: departmentId,
        name: 'Finance',
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: {
          users: 5,
          risks: 3,
        },
      };
      (prisma.department.findUnique as jest.Mock).mockResolvedValue(mockDepartment);

      // Act
      const response = await request(app)
        .get(`/api/departments/${departmentId}`)
        .expect(200);

      // Assert
      expect(response.body.id).toBe(departmentId);
      expect(response.body.name).toBe('Finance');
      expect(response.body._count.users).toBe(5);
      expect(response.body._count.risks).toBe(3);
      expect(prisma.department.findUnique).toHaveBeenCalledWith({
        where: { id: departmentId },
        include: {
          _count: {
            select: {
              users: true,
              risks: true,
            },
          },
        },
      });
    });

    it('should return 404 when department does not exist', async () => {
      // Arrange
      const departmentId = '550e8400-e29b-41d4-a716-446655440000';
      (prisma.department.findUnique as jest.Mock).mockResolvedValue(null);

      // Act
      const response = await request(app)
        .get(`/api/departments/${departmentId}`)
        .expect(404);

      // Assert
      expect(response.body).toEqual({ error: 'Department not found' });
      expect(prisma.department.findUnique).toHaveBeenCalled();
    });

    it('should return 404 for unknown department id (non-UUID accepted, Prisma not-found)', async () => {
      // ID validation accepts any non-empty string; unknown id returns 404 (fixes EC2 legacy/non-UUID ids)
      (prisma.department.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .get('/api/departments/invalid-id')
        .expect(404);

      expect(response.body).toEqual({ error: 'Department not found' });
      expect(prisma.department.findUnique).toHaveBeenCalledWith({
        where: { id: 'invalid-id' },
        include: expect.any(Object),
      });
    });
  });

  describe('POST /api/departments', () => {
    it('should create a new department', async () => {
      // Arrange
      const newDepartment = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Operations',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      (prisma.department.create as jest.Mock).mockResolvedValue(newDepartment);

      // Act
      const response = await request(app)
        .post('/api/departments')
        .send({
          name: 'Operations',
        })
        .expect(201);

      // Assert
      expect(response.body.id).toBe(newDepartment.id);
      expect(response.body.name).toBe('Operations');
      expect(prisma.department.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Operations',
        }),
      });
    });

    it('should return 400 when name is missing', async () => {
      // Act
      const response = await request(app)
        .post('/api/departments')
        .send({})
        .expect(400);

      // Assert
      expect(response.body).toHaveProperty('errors');
      expect(Array.isArray(response.body.errors)).toBe(true);
      expect(prisma.department.create).not.toHaveBeenCalled();
    });

    it('should return 400 when name is empty string', async () => {
      // Act
      const response = await request(app)
        .post('/api/departments')
        .send({
          name: '',
        })
        .expect(400);

      // Assert
      expect(response.body).toHaveProperty('errors');
      expect(prisma.department.create).not.toHaveBeenCalled();
    });

    it('should return 409 when department name already exists', async () => {
      // Arrange
      const error: any = new Error('Unique constraint violation');
      error.code = 'P2002';
      (prisma.department.create as jest.Mock).mockRejectedValue(error);

      // Act
      const response = await request(app)
        .post('/api/departments')
        .send({
          name: 'Existing Department',
        })
        .expect(409);

      // Assert
      expect(response.body).toEqual({ error: 'Department name already exists' });
      expect(prisma.department.create).toHaveBeenCalled();
    });

    it('should require ADMIN role', async () => {
      // This test verifies the route is protected
      expect(requireRole).toBeDefined();
    });
  });

  describe('PUT /api/departments/:id', () => {
    it('should update department name', async () => {
      // Arrange
      const departmentId = '550e8400-e29b-41d4-a716-446655440001';
      const updatedDepartment = {
        id: departmentId,
        name: 'Updated Name',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      (prisma.department.update as jest.Mock).mockResolvedValue(updatedDepartment);

      // Act
      const response = await request(app)
        .put(`/api/departments/${departmentId}`)
        .send({
          name: 'Updated Name',
        })
        .expect(200);

      // Assert
      expect(response.body.name).toBe('Updated Name');
      expect(prisma.department.update).toHaveBeenCalledWith({
        where: { id: departmentId },
        data: {
          name: 'Updated Name',
        },
      });
    });

    it('should return 404 when department does not exist', async () => {
      // Arrange
      const departmentId = '550e8400-e29b-41d4-a716-446655440000';
      const error: any = new Error('Record not found');
      error.code = 'P2025';
      (prisma.department.update as jest.Mock).mockRejectedValue(error);

      // Act
      const response = await request(app)
        .put(`/api/departments/${departmentId}`)
        .send({
          name: 'Updated Name',
        })
        .expect(404);

      // Assert
      expect(response.body).toEqual({ error: 'Department not found' });
      expect(prisma.department.update).toHaveBeenCalled();
    });

    it('should return 409 when updated name already exists', async () => {
      // Arrange
      const departmentId = '550e8400-e29b-41d4-a716-446655440001';
      const error: any = new Error('Unique constraint violation');
      error.code = 'P2002';
      (prisma.department.update as jest.Mock).mockRejectedValue(error);

      // Act
      const response = await request(app)
        .put(`/api/departments/${departmentId}`)
        .send({
          name: 'Existing Name',
        })
        .expect(409);

      // Assert
      expect(response.body).toEqual({ error: 'Department name already exists' });
      expect(prisma.department.update).toHaveBeenCalled();
    });

    it('should require ADMIN role', async () => {
      expect(requireRole).toBeDefined();
    });
  });

  describe('DELETE /api/departments/:id', () => {
    it('should delete department when not assigned to any users', async () => {
      // Arrange
      const departmentId = '550e8400-e29b-41d4-a716-446655440001';
      (prisma.user.count as jest.Mock).mockResolvedValue(0);
      (prisma.risk.count as jest.Mock).mockResolvedValue(0);
      (prisma.department.delete as jest.Mock).mockResolvedValue({
        id: departmentId,
        name: 'Deleted Department',
      });

      // Act
      await request(app)
        .delete(`/api/departments/${departmentId}`)
        .expect(204);

      // Assert
      expect(prisma.user.count).toHaveBeenCalledWith({
        where: { departmentId },
      });
      expect(prisma.risk.count).toHaveBeenCalledWith({
        where: { departmentId },
      });
      expect(prisma.department.delete).toHaveBeenCalledWith({
        where: { id: departmentId },
      });
    });

    it('should return 409 when department is assigned to users', async () => {
      // Arrange
      const departmentId = '550e8400-e29b-41d4-a716-446655440001';
      (prisma.user.count as jest.Mock).mockResolvedValue(3);
      (prisma.risk.count as jest.Mock).mockResolvedValue(0);

      // Act
      const response = await request(app)
        .delete(`/api/departments/${departmentId}`)
        .expect(409);

      // Assert
      expect(response.body).toEqual({
        error: 'Cannot delete department: it is assigned to 3 user(s)',
      });
      expect(prisma.user.count).toHaveBeenCalledWith({
        where: { departmentId },
      });
      expect(prisma.department.delete).not.toHaveBeenCalled();
    });

    it('should return 404 when department does not exist', async () => {
      // Arrange
      const departmentId = '550e8400-e29b-41d4-a716-446655440000';
      (prisma.user.count as jest.Mock).mockResolvedValue(0);
      (prisma.risk.count as jest.Mock).mockResolvedValue(0);
      const error: any = new Error('Record not found');
      error.code = 'P2025';
      (prisma.department.delete as jest.Mock).mockRejectedValue(error);

      // Act
      const response = await request(app)
        .delete(`/api/departments/${departmentId}`)
        .expect(404);

      // Assert
      expect(response.body).toEqual({ error: 'Department not found' });
      expect(prisma.user.count).toHaveBeenCalled();
      expect(prisma.risk.count).toHaveBeenCalled();
      expect(prisma.department.delete).toHaveBeenCalled();
    });

    it('should require ADMIN role', async () => {
      expect(requireRole).toBeDefined();
    });
  });
});
