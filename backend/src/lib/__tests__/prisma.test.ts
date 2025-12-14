/* eslint-disable @typescript-eslint/no-explicit-any */


// Mock PrismaClient before importing the module
const mockPrismaClient = jest.fn();
jest.mock('@prisma/client', () => ({
  PrismaClient: mockPrismaClient,
}));

// Mock config before importing the module
const mockConfig = {
  databaseUrl: 'postgresql://testuser:testpass@localhost:5432/testdb',
};
jest.mock('../../config', () => ({
  config: mockConfig,
}));

describe('Prisma Client Initialization', () => {
  let originalEnv: NodeJS.ProcessEnv;

  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };


    // Clear all mocks
    jest.clearAllMocks();
    mockPrismaClient.mockClear();

    // Spy on console methods
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => { });
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

    // Clear module cache to allow re-importing
    jest.resetModules();

    // Reset global state
    delete (global as any).prisma;
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    // global = originalGlobal; // Do not modify global object directly

    // Restore console methods
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('DATABASE_URL environment variable', () => {
    it('should set database URL from config before creating PrismaClient', async () => {
      // Arrange
      delete process.env.DATABASE_URL;
      const mockPrismaInstance = {
        $connect: jest.fn(),
        $disconnect: jest.fn(),
      };
      mockPrismaClient.mockReturnValue(mockPrismaInstance);

      // Act
      // Import the module to trigger initialization
      await import('../prisma');

      // Assert
      expect(process.env.DATABASE_URL).toBe(mockConfig.databaseUrl);
      expect(mockPrismaClient).toHaveBeenCalled();
    });

    it('should use config databaseUrl even if DATABASE_URL is already set', async () => {
      // Arrange
      process.env.DATABASE_URL = 'postgresql://old:old@localhost:5432/olddb';
      const mockPrismaInstance = {
        $connect: jest.fn(),
        $disconnect: jest.fn(),
      };
      mockPrismaClient.mockReturnValue(mockPrismaInstance);

      // Act
      await import('../prisma');

      // Assert
      expect(process.env.DATABASE_URL).toBe(mockConfig.databaseUrl);
    });
  });

  describe('PrismaClient initialization', () => {
    it('should create PrismaClient with correct datasource URL from config', async () => {
      // Arrange
      const mockPrismaInstance = {
        $connect: jest.fn(),
        $disconnect: jest.fn(),
      };
      mockPrismaClient.mockReturnValue(mockPrismaInstance);

      // Act
      await import('../prisma');

      // Assert
      expect(mockPrismaClient).toHaveBeenCalledWith({
        datasources: {
          db: {
            url: mockConfig.databaseUrl,
          },
        },
        log: expect.any(Array),
      });
    });

    it('should create PrismaClient with query, error, warn logs in development mode', async () => {
      // Arrange
      process.env.NODE_ENV = 'development';
      const mockPrismaInstance = {
        $connect: jest.fn(),
        $disconnect: jest.fn(),
      };
      mockPrismaClient.mockReturnValue(mockPrismaInstance);

      // Act
      await import('../prisma');

      // Assert
      expect(mockPrismaClient).toHaveBeenCalledWith(
        expect.objectContaining({
          log: ['query', 'error', 'warn'],
        })
      );
    });

    it('should create PrismaClient with only error logs in production mode', async () => {
      // Arrange
      process.env.NODE_ENV = 'production';
      const mockPrismaInstance = {
        $connect: jest.fn(),
        $disconnect: jest.fn(),
      };
      mockPrismaClient.mockReturnValue(mockPrismaInstance);

      // Act
      await import('../prisma');

      // Assert
      expect(mockPrismaClient).toHaveBeenCalledWith(
        expect.objectContaining({
          log: ['error'],
        })
      );
    });

    it('should create PrismaClient with only error logs in test mode', async () => {
      // Arrange
      process.env.NODE_ENV = 'test';
      const mockPrismaInstance = {
        $connect: jest.fn(),
        $disconnect: jest.fn(),
      };
      mockPrismaClient.mockReturnValue(mockPrismaInstance);

      // Act
      await import('../prisma');

      // Assert
      expect(mockPrismaClient).toHaveBeenCalledWith(
        expect.objectContaining({
          log: ['error'],
        })
      );
    });
  });

  describe('Development mode logging', () => {
    it('should log database URL with masked password in development mode', async () => {
      // Arrange
      process.env.NODE_ENV = 'development';
      const mockPrismaInstance = {
        $connect: jest.fn(),
        $disconnect: jest.fn(),
      };
      mockPrismaClient.mockReturnValue(mockPrismaInstance);

      // Act
      await import('../prisma');

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[PRISMA] Initializing with database URL:',
        expect.stringMatching(/postgresql:\/\/testuser:\*\*\*\*@localhost:5432\/testdb/)
      );
    });

    it('should not log database URL in production mode', async () => {
      // Arrange
      process.env.NODE_ENV = 'production';
      const mockPrismaInstance = {
        $connect: jest.fn(),
        $disconnect: jest.fn(),
      };
      mockPrismaClient.mockReturnValue(mockPrismaInstance);

      // Act
      await import('../prisma');

      // Assert
      expect(consoleLogSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('[PRISMA] Initializing with database URL:')
      );
    });

    it('should not log database URL in test mode', async () => {
      // Arrange
      process.env.NODE_ENV = 'test';
      const mockPrismaInstance = {
        $connect: jest.fn(),
        $disconnect: jest.fn(),
      };
      mockPrismaClient.mockReturnValue(mockPrismaInstance);

      // Act
      await import('../prisma');

      // Assert
      expect(consoleLogSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('[PRISMA] Initializing with database URL:')
      );
    });

    it('should mask password correctly in database URL log', async () => {
      // Arrange
      process.env.NODE_ENV = 'development';
      const mockPrismaInstance = {
        $connect: jest.fn(),
        $disconnect: jest.fn(),
      };
      mockPrismaClient.mockReturnValue(mockPrismaInstance);

      // Act
      await import('../prisma');

      // Assert
      const logCall = consoleLogSpy.mock.calls.find((call: any[]) =>
        call[0]?.includes('[PRISMA] Initializing with database URL:')
      );
      expect(logCall).toBeDefined();
      const loggedUrl = logCall?.[1];
      expect(loggedUrl).toContain('****');
      expect(loggedUrl).not.toContain('testpass');
      expect(loggedUrl).toContain('testuser');
      expect(loggedUrl).toContain('localhost:5432');
      expect(loggedUrl).toContain('testdb');
    });
  });

  describe('Global instance pattern', () => {
    it('should store prisma instance in global in non-production environments', async () => {
      // Arrange
      process.env.NODE_ENV = 'development';
      const mockPrismaInstance = {
        $connect: jest.fn(),
        $disconnect: jest.fn(),
      };
      mockPrismaClient.mockReturnValue(mockPrismaInstance);

      // Act
      const { prisma } = await import('../prisma');

      // Assert
      expect((global as any).prisma).toBe(prisma);
      expect((global as any).prisma).toBe(mockPrismaInstance);
    });

    it('should store prisma instance in global in test environment', async () => {
      // Arrange
      process.env.NODE_ENV = 'test';
      const mockPrismaInstance = {
        $connect: jest.fn(),
        $disconnect: jest.fn(),
      };
      mockPrismaClient.mockReturnValue(mockPrismaInstance);

      // Act
      const { prisma } = await import('../prisma');

      // Assert
      expect((global as any).prisma).toBe(prisma);
    });

    it('should not store prisma instance in global in production environment', async () => {
      // Arrange
      process.env.NODE_ENV = 'production';
      const mockPrismaInstance = {
        $connect: jest.fn(),
        $disconnect: jest.fn(),
      };
      mockPrismaClient.mockReturnValue(mockPrismaInstance);

      // Act
      await import('../prisma');

      // Assert
      expect((global as any).prisma).toBeUndefined();
    });

    it('should reuse existing global prisma instance in non-production environments', async () => {
      // Arrange
      process.env.NODE_ENV = 'development';
      const existingPrismaInstance = {
        $connect: jest.fn(),
        $disconnect: jest.fn(),
      };
      (global as any).prisma = existingPrismaInstance;
      const mockPrismaInstance = {
        $connect: jest.fn(),
        $disconnect: jest.fn(),
      };
      mockPrismaClient.mockReturnValue(mockPrismaInstance);

      // Act
      const { prisma } = await import('../prisma');

      // Assert
      expect(prisma).toBe(existingPrismaInstance);
      expect(mockPrismaClient).not.toHaveBeenCalled();
    });

    it('should create new instance when global prisma does not exist', async () => {
      // Arrange
      process.env.NODE_ENV = 'development';
      delete (global as any).prisma;
      const mockPrismaInstance = {
        $connect: jest.fn(),
        $disconnect: jest.fn(),
      };
      mockPrismaClient.mockReturnValue(mockPrismaInstance);

      // Act
      const { prisma } = await import('../prisma');

      // Assert
      expect(prisma).toBe(mockPrismaInstance);
      expect(mockPrismaClient).toHaveBeenCalledTimes(1);
    });
  });

  describe('Exported prisma instance', () => {
    it('should export prisma instance', async () => {
      // Arrange
      const mockPrismaInstance = {
        $connect: jest.fn(),
        $disconnect: jest.fn(),
      };
      mockPrismaClient.mockReturnValue(mockPrismaInstance);

      // Act
      const { prisma } = await import('../prisma');

      // Assert
      expect(prisma).toBeDefined();
      expect(prisma).toBe(mockPrismaInstance);
    });

    it('should export the same prisma instance on multiple imports', async () => {
      // Arrange
      process.env.NODE_ENV = 'development';
      const mockPrismaInstance = {
        $connect: jest.fn(),
        $disconnect: jest.fn(),
      };
      mockPrismaClient.mockReturnValue(mockPrismaInstance);

      // Act
      const { prisma: prisma1 } = await import('../prisma');
      const { prisma: prisma2 } = await import('../prisma');

      // Assert
      expect(prisma1).toBe(prisma2);
    });
  });

  describe('Edge cases', () => {
    it('should handle database URL with special characters in password', async () => {
      // Arrange
      process.env.NODE_ENV = 'development';
      const specialPasswordUrl = 'postgresql://user:p@ss:w0rd@localhost:5432/db';
      jest.resetModules();
      jest.doMock('../../config', () => ({
        config: {
          databaseUrl: specialPasswordUrl,
        },
      }));

      const mockPrismaInstance = {
        $connect: jest.fn(),
        $disconnect: jest.fn(),
      };
      mockPrismaClient.mockReturnValue(mockPrismaInstance);

      // Act
      await import('../prisma');

      // Assert
      expect(process.env.DATABASE_URL).toBe(specialPasswordUrl);
      expect(mockPrismaClient).toHaveBeenCalledWith(
        expect.objectContaining({
          datasources: {
            db: {
              url: specialPasswordUrl,
            },
          },
        })
      );
    });

    it('should handle database URL without password', async () => {
      // Arrange
      process.env.NODE_ENV = 'development';
      const noPasswordUrl = 'postgresql://user@localhost:5432/db';
      jest.resetModules();
      jest.doMock('../../config', () => ({
        config: {
          databaseUrl: noPasswordUrl,
        },
      }));

      const mockPrismaInstance = {
        $connect: jest.fn(),
        $disconnect: jest.fn(),
      };
      mockPrismaClient.mockReturnValue(mockPrismaInstance);

      // Act
      await import('../prisma');

      // Assert
      expect(process.env.DATABASE_URL).toBe(noPasswordUrl);
    });

    it('should handle undefined NODE_ENV', async () => {
      // Arrange
      delete process.env.NODE_ENV;
      const mockPrismaInstance = {
        $connect: jest.fn(),
        $disconnect: jest.fn(),
      };
      mockPrismaClient.mockReturnValue(mockPrismaInstance);

      // Act
      await import('../prisma');

      // Assert
      // Should default to development-like behavior (not production)
      expect(mockPrismaClient).toHaveBeenCalledWith(
        expect.objectContaining({
          log: ['error'],
        })
      );
    });
  });
});

