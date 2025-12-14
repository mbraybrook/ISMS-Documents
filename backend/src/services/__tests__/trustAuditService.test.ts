import { logTrustAction, AuditLogDetails } from '../trustAuditService';
import { prisma } from '../../lib/prisma';

// Mock Prisma
jest.mock('../../lib/prisma', () => ({
  prisma: {
    trustAuditLog: {
      create: jest.fn(),
    },
  },
}));

describe('trustAuditService', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    // Suppress console.error during tests but allow verification
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('logTrustAction', () => {
    it('should create audit log with all parameters provided', async () => {
      // Arrange
      const action = 'DOCUMENT_VIEWED';
      const performedByUserId = 'user-123';
      const performedByExternalUserId = 'external-user-456';
      const targetUserId = 'target-user-789';
      const targetDocumentId = 'doc-123';
      const details: AuditLogDetails = {
        documentTitle: 'Test Document',
        viewDuration: 120,
        metadata: { source: 'web' },
      };
      const ipAddress = '192.168.1.1';

      const mockCreatedLog = {
        id: 'log-123',
        action,
        performedByUserId,
        performedByExternalUserId,
        targetUserId,
        targetDocumentId,
        details: JSON.stringify(details),
        ipAddress,
        timestamp: new Date(),
      };

      (prisma.trustAuditLog.create as jest.Mock).mockResolvedValue(mockCreatedLog);

      // Act
      await logTrustAction(
        action,
        performedByUserId,
        performedByExternalUserId,
        targetUserId,
        targetDocumentId,
        details,
        ipAddress
      );

      // Assert
      expect(prisma.trustAuditLog.create).toHaveBeenCalledTimes(1);
      expect(prisma.trustAuditLog.create).toHaveBeenCalledWith({
        data: {
          action,
          performedByUserId,
          performedByExternalUserId,
          targetUserId,
          targetDocumentId,
          details: JSON.stringify(details),
          ipAddress,
        },
      });
    });

    it('should create audit log with only required action parameter', async () => {
      // Arrange
      const action = 'LOGIN_ATTEMPT';
      const mockCreatedLog = {
        id: 'log-456',
        action,
        performedByUserId: null,
        performedByExternalUserId: null,
        targetUserId: null,
        targetDocumentId: null,
        details: null,
        ipAddress: null,
        timestamp: new Date(),
      };

      (prisma.trustAuditLog.create as jest.Mock).mockResolvedValue(mockCreatedLog);

      // Act
      await logTrustAction(action);

      // Assert
      expect(prisma.trustAuditLog.create).toHaveBeenCalledTimes(1);
      expect(prisma.trustAuditLog.create).toHaveBeenCalledWith({
        data: {
          action,
          performedByUserId: null,
          performedByExternalUserId: null,
          targetUserId: null,
          targetDocumentId: null,
          details: null,
          ipAddress: null,
        },
      });
    });

    it('should convert undefined optional parameters to null', async () => {
      // Arrange
      const action = 'ACTION_WITH_UNDEFINED';
      const mockCreatedLog = {
        id: 'log-789',
        action,
        performedByUserId: null,
        performedByExternalUserId: null,
        targetUserId: null,
        targetDocumentId: null,
        details: null,
        ipAddress: null,
        timestamp: new Date(),
      };

      (prisma.trustAuditLog.create as jest.Mock).mockResolvedValue(mockCreatedLog);

      // Act
      await logTrustAction(
        action,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined
      );

      // Assert
      expect(prisma.trustAuditLog.create).toHaveBeenCalledTimes(1);
      expect(prisma.trustAuditLog.create).toHaveBeenCalledWith({
        data: {
          action,
          performedByUserId: null,
          performedByExternalUserId: null,
          targetUserId: null,
          targetDocumentId: null,
          details: null,
          ipAddress: null,
        },
      });
    });

    it('should create audit log with only performedByUserId', async () => {
      // Arrange
      const action = 'USER_ACTION';
      const performedByUserId = 'user-abc';
      const mockCreatedLog = {
        id: 'log-abc',
        action,
        performedByUserId,
        performedByExternalUserId: null,
        targetUserId: null,
        targetDocumentId: null,
        details: null,
        ipAddress: null,
        timestamp: new Date(),
      };

      (prisma.trustAuditLog.create as jest.Mock).mockResolvedValue(mockCreatedLog);

      // Act
      await logTrustAction(action, performedByUserId);

      // Assert
      expect(prisma.trustAuditLog.create).toHaveBeenCalledWith({
        data: {
          action,
          performedByUserId,
          performedByExternalUserId: null,
          targetUserId: null,
          targetDocumentId: null,
          details: null,
          ipAddress: null,
        },
      });
    });

    it('should create audit log with only performedByExternalUserId', async () => {
      // Arrange
      const action = 'EXTERNAL_USER_ACTION';
      const performedByExternalUserId = 'external-user-xyz';
      const mockCreatedLog = {
        id: 'log-xyz',
        action,
        performedByUserId: null,
        performedByExternalUserId,
        targetUserId: null,
        targetDocumentId: null,
        details: null,
        ipAddress: null,
        timestamp: new Date(),
      };

      (prisma.trustAuditLog.create as jest.Mock).mockResolvedValue(mockCreatedLog);

      // Act
      await logTrustAction(action, undefined, performedByExternalUserId);

      // Assert
      expect(prisma.trustAuditLog.create).toHaveBeenCalledWith({
        data: {
          action,
          performedByUserId: null,
          performedByExternalUserId,
          targetUserId: null,
          targetDocumentId: null,
          details: null,
          ipAddress: null,
        },
      });
    });

    it('should create audit log with details object', async () => {
      // Arrange
      const action = 'DOCUMENT_EDITED';
      const details: AuditLogDetails = {
        changes: ['title', 'content'],
        previousVersion: '1.0',
        newVersion: '1.1',
        editor: 'John Doe',
      };
      const mockCreatedLog = {
        id: 'log-details',
        action,
        performedByUserId: null,
        performedByExternalUserId: null,
        targetUserId: null,
        targetDocumentId: null,
        details: JSON.stringify(details),
        ipAddress: null,
        timestamp: new Date(),
      };

      (prisma.trustAuditLog.create as jest.Mock).mockResolvedValue(mockCreatedLog);

      // Act
      await logTrustAction(action, undefined, undefined, undefined, undefined, details);

      // Assert
      expect(prisma.trustAuditLog.create).toHaveBeenCalledWith({
        data: {
          action,
          performedByUserId: null,
          performedByExternalUserId: null,
          targetUserId: null,
          targetDocumentId: null,
          details: JSON.stringify(details),
          ipAddress: null,
        },
      });
    });

    it('should create audit log with empty details object', async () => {
      // Arrange
      const action = 'ACTION_WITH_EMPTY_DETAILS';
      const details: AuditLogDetails = {};
      const mockCreatedLog = {
        id: 'log-empty',
        action,
        performedByUserId: null,
        performedByExternalUserId: null,
        targetUserId: null,
        targetDocumentId: null,
        details: JSON.stringify(details),
        ipAddress: null,
        timestamp: new Date(),
      };

      (prisma.trustAuditLog.create as jest.Mock).mockResolvedValue(mockCreatedLog);

      // Act
      await logTrustAction(action, undefined, undefined, undefined, undefined, details);

      // Assert
      expect(prisma.trustAuditLog.create).toHaveBeenCalledWith({
        data: {
          action,
          performedByUserId: null,
          performedByExternalUserId: null,
          targetUserId: null,
          targetDocumentId: null,
          details: JSON.stringify(details),
          ipAddress: null,
        },
      });
    });

    it('should create audit log with complex nested details object', async () => {
      // Arrange
      const action = 'COMPLEX_ACTION';
      const details: AuditLogDetails = {
        nested: {
          level1: {
            level2: {
              value: 'deep',
            },
          },
        },
        array: [1, 2, 3],
        boolean: true,
        number: 42,
        string: 'test',
      };
      const mockCreatedLog = {
        id: 'log-complex',
        action,
        performedByUserId: null,
        performedByExternalUserId: null,
        targetUserId: null,
        targetDocumentId: null,
        details: JSON.stringify(details),
        ipAddress: null,
        timestamp: new Date(),
      };

      (prisma.trustAuditLog.create as jest.Mock).mockResolvedValue(mockCreatedLog);

      // Act
      await logTrustAction(action, undefined, undefined, undefined, undefined, details);

      // Assert
      expect(prisma.trustAuditLog.create).toHaveBeenCalledWith({
        data: {
          action,
          performedByUserId: null,
          performedByExternalUserId: null,
          targetUserId: null,
          targetDocumentId: null,
          details: JSON.stringify(details),
          ipAddress: null,
        },
      });
      // Verify JSON stringification worked correctly
      const callArgs = (prisma.trustAuditLog.create as jest.Mock).mock.calls[0][0];
      expect(JSON.parse(callArgs.data.details)).toEqual(details);
    });

    it('should create audit log with ipAddress only', async () => {
      // Arrange
      const action = 'IP_TRACKED_ACTION';
      const ipAddress = '10.0.0.1';
      const mockCreatedLog = {
        id: 'log-ip',
        action,
        performedByUserId: null,
        performedByExternalUserId: null,
        targetUserId: null,
        targetDocumentId: null,
        details: null,
        ipAddress,
        timestamp: new Date(),
      };

      (prisma.trustAuditLog.create as jest.Mock).mockResolvedValue(mockCreatedLog);

      // Act
      await logTrustAction(
        action,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        ipAddress
      );

      // Assert
      expect(prisma.trustAuditLog.create).toHaveBeenCalledWith({
        data: {
          action,
          performedByUserId: null,
          performedByExternalUserId: null,
          targetUserId: null,
          targetDocumentId: null,
          details: null,
          ipAddress,
        },
      });
    });

    it('should create audit log with targetUserId and targetDocumentId', async () => {
      // Arrange
      const action = 'TARGET_ACTION';
      const targetUserId = 'target-user-123';
      const targetDocumentId = 'target-doc-456';
      const mockCreatedLog = {
        id: 'log-target',
        action,
        performedByUserId: null,
        performedByExternalUserId: null,
        targetUserId,
        targetDocumentId,
        details: null,
        ipAddress: null,
        timestamp: new Date(),
      };

      (prisma.trustAuditLog.create as jest.Mock).mockResolvedValue(mockCreatedLog);

      // Act
      await logTrustAction(
        action,
        undefined,
        undefined,
        targetUserId,
        targetDocumentId
      );

      // Assert
      expect(prisma.trustAuditLog.create).toHaveBeenCalledWith({
        data: {
          action,
          performedByUserId: null,
          performedByExternalUserId: null,
          targetUserId,
          targetDocumentId,
          details: null,
          ipAddress: null,
        },
      });
    });

    it('should handle database errors gracefully without throwing', async () => {
      // Arrange
      const action = 'FAILING_ACTION';
      const databaseError = new Error('Database connection failed');
      (prisma.trustAuditLog.create as jest.Mock).mockRejectedValue(databaseError);

      // Act & Assert - should not throw
      await expect(logTrustAction(action)).resolves.not.toThrow();

      // Verify error was logged
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[TRUST_AUDIT] Failed to log action:',
        databaseError
      );

      // Verify Prisma was still called
      expect(prisma.trustAuditLog.create).toHaveBeenCalledTimes(1);
    });

    it('should handle Prisma validation errors without throwing', async () => {
      // Arrange
      const action = 'INVALID_ACTION';
      const validationError = new Error('Invalid input: action field is required');
      (prisma.trustAuditLog.create as jest.Mock).mockRejectedValue(validationError);

      // Act & Assert - should not throw
      await expect(logTrustAction(action)).resolves.not.toThrow();

      // Verify error was logged
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[TRUST_AUDIT] Failed to log action:',
        validationError
      );
    });

    it('should handle network errors without throwing', async () => {
      // Arrange
      const action = 'NETWORK_ERROR_ACTION';
      const networkError = new Error('Network timeout');
      (prisma.trustAuditLog.create as jest.Mock).mockRejectedValue(networkError);

      // Act & Assert - should not throw
      await expect(logTrustAction(action)).resolves.not.toThrow();

      // Verify error was logged
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[TRUST_AUDIT] Failed to log action:',
        networkError
      );
    });

    it('should handle multiple consecutive calls successfully', async () => {
      // Arrange
      const action1 = 'ACTION_1';
      const action2 = 'ACTION_2';
      const action3 = 'ACTION_3';

      (prisma.trustAuditLog.create as jest.Mock).mockResolvedValue({ id: 'log' });

      // Act
      await logTrustAction(action1);
      await logTrustAction(action2);
      await logTrustAction(action3);

      // Assert
      expect(prisma.trustAuditLog.create).toHaveBeenCalledTimes(3);
      expect(prisma.trustAuditLog.create).toHaveBeenNthCalledWith(1, {
        data: {
          action: action1,
          performedByUserId: null,
          performedByExternalUserId: null,
          targetUserId: null,
          targetDocumentId: null,
          details: null,
          ipAddress: null,
        },
      });
      expect(prisma.trustAuditLog.create).toHaveBeenNthCalledWith(2, {
        data: {
          action: action2,
          performedByUserId: null,
          performedByExternalUserId: null,
          targetUserId: null,
          targetDocumentId: null,
          details: null,
          ipAddress: null,
        },
      });
      expect(prisma.trustAuditLog.create).toHaveBeenNthCalledWith(3, {
        data: {
          action: action3,
          performedByUserId: null,
          performedByExternalUserId: null,
          targetUserId: null,
          targetDocumentId: null,
          details: null,
          ipAddress: null,
        },
      });
    });

    it('should handle mixed success and failure scenarios', async () => {
      // Arrange
      const action1 = 'SUCCESS_ACTION';
      const action2 = 'FAILING_ACTION';
      const action3 = 'SUCCESS_ACTION_2';

      const successLog = { id: 'log-success' };
      const databaseError = new Error('Database error');

      (prisma.trustAuditLog.create as jest.Mock)
        .mockResolvedValueOnce(successLog)
        .mockRejectedValueOnce(databaseError)
        .mockResolvedValueOnce(successLog);

      // Act
      await logTrustAction(action1);
      await logTrustAction(action2);
      await logTrustAction(action3);

      // Assert
      expect(prisma.trustAuditLog.create).toHaveBeenCalledTimes(3);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[TRUST_AUDIT] Failed to log action:',
        databaseError
      );
    });

    it('should handle details with special characters in JSON', async () => {
      // Arrange
      const action = 'SPECIAL_CHARS_ACTION';
      const details: AuditLogDetails = {
        message: 'Test with "quotes" and \'apostrophes\'',
        newline: 'Line 1\nLine 2',
        unicode: '测试 🎉',
        special: '!@#$%^&*()',
      };
      const mockCreatedLog = {
        id: 'log-special',
        action,
        performedByUserId: null,
        performedByExternalUserId: null,
        targetUserId: null,
        targetDocumentId: null,
        details: JSON.stringify(details),
        ipAddress: null,
        timestamp: new Date(),
      };

      (prisma.trustAuditLog.create as jest.Mock).mockResolvedValue(mockCreatedLog);

      // Act
      await logTrustAction(action, undefined, undefined, undefined, undefined, details);

      // Assert
      expect(prisma.trustAuditLog.create).toHaveBeenCalledTimes(1);
      const callArgs = (prisma.trustAuditLog.create as jest.Mock).mock.calls[0][0];
      const parsedDetails = JSON.parse(callArgs.data.details);
      expect(parsedDetails).toEqual(details);
      expect(parsedDetails.message).toBe('Test with "quotes" and \'apostrophes\'');
      expect(parsedDetails.unicode).toBe('测试 🎉');
    });
  });
});


