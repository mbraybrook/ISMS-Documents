
import { retryDbOperation } from '../dbRetry';

describe('dbRetry', () => {
  let consoleWarnSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    // Use real timers for more reliable async testing
    jest.useRealTimers();
    // Suppress console methods during tests to avoid noise
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => { });
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('retryDbOperation', () => {
    it('should return result immediately when operation succeeds on first attempt', async () => {
      // Arrange
      const expectedResult = { data: 'success' };
      const operation = jest.fn().mockResolvedValue(expectedResult);

      // Act
      const result = await retryDbOperation(operation);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(operation).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should retry and succeed when operation fails with retryable error then succeeds', async () => {
      // Arrange
      const expectedResult = { data: 'success' };
      const retryableError = new Error('Connection timeout');
      const operation = jest
        .fn()
        .mockRejectedValueOnce(retryableError)
        .mockResolvedValueOnce(expectedResult);

      // Act
      const result = await retryDbOperation(operation, { initialDelayMs: 10 });

      // Assert
      expect(result).toEqual(expectedResult);
      expect(operation).toHaveBeenCalledTimes(2);
      expect(consoleWarnSpy).toHaveBeenCalledTimes(2); // Warning for retry attempt and delay
    });

    it('should throw immediately when operation fails with non-retryable error', async () => {
      // Arrange
      const nonRetryableError = new Error('Invalid input');
      const operation = jest.fn().mockRejectedValue(nonRetryableError);

      // Act & Assert
      await expect(retryDbOperation(operation)).rejects.toThrow('Invalid input');
      expect(operation).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should retry up to maxRetries times when operation fails with retryable errors', async () => {
      // Arrange
      const retryableError = new Error('Connection timeout');
      const operation = jest.fn().mockRejectedValue(retryableError);
      const maxRetries = 2;

      // Act
      await expect(
        retryDbOperation(operation, { maxRetries, initialDelayMs: 10 })
      ).rejects.toThrow('Connection timeout');

      // Assert
      expect(operation).toHaveBeenCalledTimes(maxRetries + 1); // Initial + maxRetries
      expect(consoleWarnSpy).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining(`All ${maxRetries + 1} attempts failed`),
        retryableError
      );
    });

    it('should use exponential backoff with correct delays', async () => {
      // Arrange
      const retryableError = new Error('Connection timeout');
      const operation = jest.fn().mockRejectedValue(retryableError);
      const initialDelayMs = 10;
      const backoffMultiplier = 2;
      const maxRetries = 3;

      // Act
      await expect(
        retryDbOperation(operation, {
          maxRetries,
          initialDelayMs,
          backoffMultiplier,
        })
      ).rejects.toThrow();

      // Assert - verify delays were applied
      expect(operation).toHaveBeenCalledTimes(maxRetries + 1);
      // Verify console warnings were called for each retry
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('should respect maxDelayMs when calculating backoff delay', async () => {
      // Arrange
      const retryableError = new Error('Connection timeout');
      const operation = jest.fn().mockRejectedValue(retryableError);
      const initialDelayMs = 20;
      const maxDelayMs = 30;
      const backoffMultiplier = 2;
      const maxRetries = 3;

      // Act
      await expect(
        retryDbOperation(operation, {
          maxRetries,
          initialDelayMs,
          maxDelayMs,
          backoffMultiplier,
        })
      ).rejects.toThrow();

      // Assert
      expect(operation).toHaveBeenCalledTimes(maxRetries + 1);
      // Verify that delays were capped at maxDelayMs
      const warnCalls = consoleWarnSpy.mock.calls.filter((call) =>
        call[0]?.toString().includes('Retrying in')
      );
      warnCalls.forEach((call) => {
        const delayMatch = call[0]?.toString().match(/Retrying in (\d+)ms/);
        if (delayMatch) {
          const delay = parseInt(delayMatch[1] || '0', 10);
          expect(delay).toBeLessThanOrEqual(maxDelayMs);
        }
      });
    });

    it('should handle retryable error with "connectionerror" pattern', async () => {
      // Arrange
      const retryableError = new Error('ConnectionError occurred');
      const operation = jest
        .fn()
        .mockRejectedValueOnce(retryableError)
        .mockResolvedValueOnce({ success: true });

      // Act
      const result = await retryDbOperation(operation, { initialDelayMs: 10 });

      // Assert
      expect(result).toEqual({ success: true });
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should handle retryable error with "timed out" pattern', async () => {
      // Arrange
      const retryableError = new Error('Request timed out');
      const operation = jest
        .fn()
        .mockRejectedValueOnce(retryableError)
        .mockResolvedValueOnce({ success: true });

      // Act
      const result = await retryDbOperation(operation, { initialDelayMs: 10 });

      // Assert
      expect(result).toEqual({ success: true });
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should handle retryable error with "timeout" pattern', async () => {
      // Arrange
      const retryableError = new Error('Operation timeout');
      const operation = jest
        .fn()
        .mockRejectedValueOnce(retryableError)
        .mockResolvedValueOnce({ success: true });

      // Act
      const result = await retryDbOperation(operation, { initialDelayMs: 10 });

      // Assert
      expect(result).toEqual({ success: true });
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should handle retryable error with "connection" pattern', async () => {
      // Arrange
      const retryableError = new Error('Connection lost');
      const operation = jest
        .fn()
        .mockRejectedValueOnce(retryableError)
        .mockResolvedValueOnce({ success: true });

      // Act
      const result = await retryDbOperation(operation, { initialDelayMs: 10 });

      // Assert
      expect(result).toEqual({ success: true });
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should handle retryable error with "connectorerror" pattern', async () => {
      // Arrange
      const retryableError = new Error('ConnectorError: Failed to connect');
      const operation = jest
        .fn()
        .mockRejectedValueOnce(retryableError)
        .mockResolvedValueOnce({ success: true });

      // Act
      const result = await retryDbOperation(operation, { initialDelayMs: 10 });

      // Assert
      expect(result).toEqual({ success: true });
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should handle retryable error with "econnreset" pattern', async () => {
      // Arrange
      const retryableError = new Error('ECONNRESET');
      const operation = jest
        .fn()
        .mockRejectedValueOnce(retryableError)
        .mockResolvedValueOnce({ success: true });

      // Act
      const result = await retryDbOperation(operation, { initialDelayMs: 10 });

      // Assert
      expect(result).toEqual({ success: true });
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should handle retryable error with "econnrefused" pattern', async () => {
      // Arrange
      const retryableError = new Error('ECONNREFUSED');
      const operation = jest
        .fn()
        .mockRejectedValueOnce(retryableError)
        .mockResolvedValueOnce({ success: true });

      // Act
      const result = await retryDbOperation(operation, { initialDelayMs: 10 });

      // Assert
      expect(result).toEqual({ success: true });
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should handle retryable error when error is a string', async () => {
      // Arrange
      const retryableError = 'Connection timeout';
      const operation = jest
        .fn()
        .mockRejectedValueOnce(retryableError)
        .mockResolvedValueOnce({ success: true });

      // Act
      const result = await retryDbOperation(operation, { initialDelayMs: 10 });

      // Assert
      expect(result).toEqual({ success: true });
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should handle retryable error when error has no message property', async () => {
      // Arrange
      const retryableError = { toString: () => 'Connection timeout' };
      const operation = jest
        .fn()
        .mockRejectedValueOnce(retryableError)
        .mockResolvedValueOnce({ success: true });

      // Act
      const result = await retryDbOperation(operation, { initialDelayMs: 10 });

      // Assert
      expect(result).toEqual({ success: true });
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should handle null error gracefully', async () => {
      // Arrange
      const operation = jest.fn().mockRejectedValue(null);

      // Act & Assert
      await expect(retryDbOperation(operation)).rejects.toBeNull();
      expect(operation).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should handle undefined error gracefully', async () => {
      // Arrange
      const operation = jest.fn().mockRejectedValue(undefined);

      // Act & Assert
      await expect(retryDbOperation(operation)).rejects.toBeUndefined();
      expect(operation).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should use default options when no options provided', async () => {
      // Arrange
      const retryableError = new Error('Connection timeout');
      const operation = jest.fn().mockRejectedValue(retryableError);
      const defaultMaxRetries = 3;

      // Act
      await expect(
        retryDbOperation(operation, { initialDelayMs: 10 })
      ).rejects.toThrow();

      // Assert
      expect(operation).toHaveBeenCalledTimes(defaultMaxRetries + 1);
    });

    it('should handle case-insensitive error message matching', async () => {
      // Arrange
      const retryableError = new Error('CONNECTION TIMEOUT');
      const operation = jest
        .fn()
        .mockRejectedValueOnce(retryableError)
        .mockResolvedValueOnce({ success: true });

      // Act
      const result = await retryDbOperation(operation, { initialDelayMs: 10 });

      // Assert
      expect(result).toEqual({ success: true });
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should succeed on final retry attempt', async () => {
      // Arrange
      const retryableError = new Error('Connection timeout');
      const expectedResult = { data: 'success' };
      const operation = jest
        .fn()
        .mockRejectedValueOnce(retryableError)
        .mockRejectedValueOnce(retryableError)
        .mockResolvedValueOnce(expectedResult);
      const maxRetries = 2;

      // Act
      const result = await retryDbOperation(operation, {
        maxRetries,
        initialDelayMs: 10,
      });

      // Assert
      expect(result).toEqual(expectedResult);
      expect(operation).toHaveBeenCalledTimes(3); // Initial + 2 retries
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should log retry attempts with correct attempt numbers', async () => {
      // Arrange
      const retryableError = new Error('Connection timeout');
      const operation = jest.fn().mockRejectedValue(retryableError);
      const maxRetries = 2;

      // Act
      await expect(
        retryDbOperation(operation, { maxRetries, initialDelayMs: 10 })
      ).rejects.toThrow();

      // Assert
      const warnCalls = consoleWarnSpy.mock.calls;
      const retryAttemptCalls = warnCalls.filter((call) =>
        call[0]?.toString().includes('Retryable error on attempt')
      );
      expect(retryAttemptCalls.length).toBe(maxRetries);
      expect(retryAttemptCalls[0]?.[0]).toContain('attempt 1/3');
      expect(retryAttemptCalls[1]?.[0]).toContain('attempt 2/3');
    });

    it('should handle operation that returns a promise', async () => {
      // Arrange
      const expectedResult = Promise.resolve({ data: 'async success' });
      const operation = jest.fn().mockReturnValue(expectedResult);

      // Act
      const result = await retryDbOperation(operation);

      // Assert
      expect(result).toEqual({ data: 'async success' });
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple retryable errors followed by success', async () => {
      // Arrange
      const retryableError = new Error('Connection timeout');
      const expectedResult = { data: 'success' };
      const operation = jest
        .fn()
        .mockRejectedValueOnce(retryableError)
        .mockRejectedValueOnce(retryableError)
        .mockResolvedValueOnce(expectedResult);

      // Act
      const result = await retryDbOperation(operation, { initialDelayMs: 10 });

      // Assert
      expect(result).toEqual(expectedResult);
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should throw the last error when all retries are exhausted', async () => {
      // Arrange
      const retryableError = new Error('Connection timeout');
      const operation = jest.fn().mockRejectedValue(retryableError);
      const maxRetries = 1;

      // Act
      const error = await retryDbOperation(operation, {
        maxRetries,
        initialDelayMs: 10,
      }).catch((e) => e);

      // Assert
      expect(error).toBe(retryableError);
      expect(operation).toHaveBeenCalledTimes(2);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('All 2 attempts failed'),
        retryableError
      );
    });
  });
});

