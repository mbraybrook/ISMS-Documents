// Test setup file - runs before each test file
// This file is referenced in jest.config.js setupFilesAfterEnv

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.AUTH_ALLOWED_EMAIL_DOMAIN = 'paythru.com';

// Suppress console.error during tests to reduce noise from expected error handling
// This prevents console.error calls in route handlers and services from polluting test output
// when tests intentionally trigger error paths (e.g., testing error handling)
//
// Note: Individual test files can still suppress/restore console methods using helpers
// from test-helpers.ts if they need to verify console.error was called
//
// Store original for potential restoration
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as any).__originalConsoleError = console.error;

// Suppress console.error globally - tests can restore it if needed
console.error = jest.fn() as typeof console.error;


