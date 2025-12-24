// Test setup file - runs before each test file
// This file is referenced in jest.config.js setupFilesAfterEnv

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.AUTH_ALLOWED_EMAIL_DOMAIN = 'paythru.com';

// Suppress console.error and console.warn during tests to reduce noise from expected error handling
// This prevents console.error/warn calls in route handlers and services from polluting test output
// when tests intentionally trigger error paths (e.g., testing error handling)
//
// Note: Individual test files can still suppress/restore console methods using helpers
// from test-helpers.ts if they need to verify console.error/warn was called
//
// Store original for potential restoration
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as any).__originalConsoleError = console.error;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as any).__originalConsoleWarn = console.warn;

// Suppress console.error and console.warn globally - tests can restore them if needed
console.error = jest.fn() as typeof console.error;
console.warn = jest.fn() as typeof console.warn;


