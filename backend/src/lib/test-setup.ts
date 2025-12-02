// Test setup file - runs before each test file
// This file is referenced in jest.config.js setupFilesAfterEnv

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.AUTH_ALLOWED_EMAIL_DOMAIN = 'paythru.com';

// Mock console methods to reduce noise in tests (optional)
// Uncomment if you want to suppress console logs during tests
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
//   error: jest.fn(),
// };

