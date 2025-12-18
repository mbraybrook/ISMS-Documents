import { expect, afterEach, vi, beforeAll, afterAll } from 'vitest';
import { cleanup, configure } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { server } from './mocks/server';
// Import MSAL mock to ensure it's applied globally
import './mocks/msal';
// Import authService mock to ensure it's applied globally
import './mocks/authService';

// Configure React Testing Library to automatically handle async updates
// This reduces act() warnings by waiting for state updates
configure({
  asyncUtilTimeout: 5000,
  // Use default async utilities which handle act() automatically
  testIdAttribute: 'data-testid',
  // Automatically wrap async operations in act()
  // This helps reduce warnings from cascading useEffect hooks
  defaultHidden: true,
});

// Mock config globally for all tests (prevents MSAL config errors in CI)
vi.mock('../config', () => ({
  config: {
    apiUrl: 'http://localhost:4000',
    auth: {
      tenantId: 'test-tenant-id',
      clientId: 'test-client-id',
      redirectUri: 'http://localhost:3000',
    },
  },
}));

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers);

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Setup MSW server
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() { }
  disconnect() { }
  observe() { }
  takeRecords() {
    return [];
  }
  unobserve() { }
} as unknown as typeof IntersectionObserver;

// Mock ResizeObserver (required for recharts ResponsiveContainer)
global.ResizeObserver = class ResizeObserver {
  constructor() { }
  disconnect() { }
  observe() { }
  unobserve() { }
} as unknown as typeof ResizeObserver;

// Mock @zag-js/focus-visible to prevent jsdom compatibility errors
// This is a known compatibility issue between jsdom and Chakra UI's focus-visible library
// The mock must be hoisted (Vitest does this automatically) to work before module imports
vi.mock('@zag-js/focus-visible', () => {
  const mockCleanup = vi.fn();
  const mockTrackFocusVisible = vi.fn(() => ({
    cleanup: mockCleanup,
  }));

  // Mock setupGlobalFocusEvents to prevent focus property errors
  // This function is called internally and tries to set focus properties that don't exist in jsdom
  const mockSetupGlobalFocusEvents = vi.fn(() => {
    // Return a no-op cleanup function
    return mockCleanup;
  });

  return {
    trackFocusVisible: mockTrackFocusVisible,
    setupGlobalFocusEvents: mockSetupGlobalFocusEvents,
    default: {
      trackFocusVisible: mockTrackFocusVisible,
      setupGlobalFocusEvents: mockSetupGlobalFocusEvents,
    },
  };
});

// Suppress unhandled errors and rejections related to focus property
// These errors occur when @zag-js/focus-visible tries to set focus on HTMLElement in jsdom
beforeAll(() => {
  // Handle unhandled promise rejections
  const originalUnhandledRejection = process.listeners('unhandledRejection')[0];
  process.removeAllListeners('unhandledRejection');
  process.on('unhandledRejection', (reason) => {
    const reasonStr = String(reason);
    const errorMessage = reason instanceof Error ? reason.message : reasonStr;
    if (
      reasonStr.includes('Cannot set property focus') ||
      reasonStr.includes('focus-visible') ||
      reasonStr.includes('setupGlobalFocusEvents') ||
      reasonStr.includes('trackFocusVisible') ||
      errorMessage.includes('Cannot set property focus') ||
      errorMessage.includes('focus-visible') ||
      errorMessage.includes('setupGlobalFocusEvents') ||
      errorMessage.includes('trackFocusVisible')
    ) {
      // Suppress these errors - they don't affect test functionality
      return;
    }
    // Re-throw other unhandled rejections
    if (originalUnhandledRejection) {
      originalUnhandledRejection(reason, Promise.resolve());
    } else {
      throw reason;
    }
  });

  // Handle uncaught exceptions (synchronous errors that often crash tests)
  const originalUncaughtException = process.listeners('uncaughtException')[0];
  process.removeAllListeners('uncaughtException');
  process.on('uncaughtException', (error) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (
      errorMessage.includes('Cannot set property focus') ||
      errorMessage.includes('focus-visible') ||
      errorMessage.includes('setupGlobalFocusEvents') ||
      errorMessage.includes('trackFocusVisible')
    ) {
      // Suppress known noisy errors
      return;
    }

    if (originalUncaughtException) {
      originalUncaughtException(error, 'uncaughtException');
    } else {
      console.error('Uncaught Exception:', error);
      process.exit(1);
    }
  });

  // Handle window errors (synchronous errors)
  const originalErrorHandler = window.onerror;
  window.onerror = (message, source, lineno, colno, error) => {
    const errorMessage = String(message);
    const errorMsg = error?.message || '';
    if (
      errorMessage.includes('Cannot set property focus') ||
      errorMessage.includes('focus-visible') ||
      errorMessage.includes('setupGlobalFocusEvents') ||
      errorMessage.includes('trackFocusVisible') ||
      errorMsg.includes('Cannot set property focus') ||
      errorMsg.includes('focus-visible') ||
      errorMsg.includes('setupGlobalFocusEvents') ||
      errorMsg.includes('trackFocusVisible')
    ) {
      return true; // Suppress the error
    }
    // Call original handler for other errors
    if (originalErrorHandler) {
      return originalErrorHandler(message, source, lineno, colno, error);
    }
    return false;
  };
});

afterAll(() => {
  // Note: process listeners are managed by Vitest, but we restore window.onerror if needed
  // In practice, Vitest cleans up process listeners automatically
});

// Note: There's a known jsdom/Chakra UI compatibility issue with @zag-js/focus-visible
// that causes "Cannot set property focus" errors. This doesn't affect test functionality
// but may appear in test output. The timeout issue has been resolved separately.
// We mock the library above to prevent these errors.

// Suppress console logs in test environment to reduce noise
// Only suppress logs/warns, keep errors visible for debugging test failures
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

beforeAll(() => {
  // Suppress console.log and console.warn to reduce test output noise
  console.log = vi.fn();
  console.warn = vi.fn();

  // Keep console.error but filter out known noisy errors
  // This allows actual test failures to be visible while suppressing expected errors
  console.error = vi.fn((...args) => {
    const message = args.join(' ');
    // Suppress known noisy errors that don't indicate test failures
    if (
      message.includes('[vitest]') ||
      message.includes('Warning:') ||
      message.includes('Consider adding an error boundary') ||
      message.includes('Cannot set property focus') ||
      message.includes('focus-visible') ||
      message.includes('setupGlobalFocusEvents') ||
      message.includes('trackFocusVisible')
    ) {
      return;
    }
    // Allow other errors through for debugging
    originalConsoleError(...args);
  });
});

afterAll(() => {
  // Restore original console methods after all tests
  console.log = originalConsoleLog;
  console.warn = originalConsoleWarn;
  console.error = originalConsoleError;
});

