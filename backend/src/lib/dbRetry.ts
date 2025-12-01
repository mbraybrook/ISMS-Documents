/**
 * Utility functions for retrying database operations with exponential backoff
 * Handles transient connection errors, especially common with SQLite
 */

interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelayMs: 100,
  maxDelayMs: 2000,
  backoffMultiplier: 2,
};

/**
 * Checks if an error is a transient database error that should be retried
 */
function isRetryableError(error: any): boolean {
  if (!error) return false;

  const errorMessage = error.message?.toLowerCase() || '';
  const errorString = String(error).toLowerCase();

  // Check for connection/timeout errors
  const retryablePatterns = [
    'connectionerror',
    'timed out',
    'timeout',
    'connection',
    'connectorerror',
    'database is locked',
    'sqlite_busy',
    'econnreset',
    'econnrefused',
  ];

  return retryablePatterns.some(
    (pattern) => errorMessage.includes(pattern) || errorString.includes(pattern)
  );
}

/**
 * Sleep for the specified number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retries a database operation with exponential backoff
 * 
 * @param operation - The async function to retry
 * @param options - Retry configuration options
 * @returns The result of the operation
 * @throws The last error if all retries are exhausted
 */
export async function retryDbOperation<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: any;
  let delay = opts.initialDelayMs;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      // Don't retry if it's not a retryable error
      if (!isRetryableError(error)) {
        throw error;
      }

      // Don't retry on the last attempt
      if (attempt === opts.maxRetries) {
        break;
      }

      // Log retry attempt
      console.warn(
        `[DB_RETRY] Retryable error on attempt ${attempt + 1}/${opts.maxRetries + 1}:`,
        error instanceof Error ? error.message : String(error)
      );
      console.warn(`[DB_RETRY] Retrying in ${delay}ms...`);

      // Wait before retrying
      await sleep(delay);

      // Exponential backoff
      delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelayMs);
    }
  }

  // All retries exhausted
  console.error(
    `[DB_RETRY] All ${opts.maxRetries + 1} attempts failed. Last error:`,
    lastError
  );
  throw lastError;
}


