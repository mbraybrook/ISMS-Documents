import { closePrisma } from './db';

/**
 * Global teardown for E2E tests
 * Runs once after all tests
 */
async function globalTeardown() {
  console.log('Tearing down E2E test environment...');
  
  // Close database connections
  try {
    await closePrisma();
    console.log('Database connections closed');
  } catch (error) {
    console.error('Error during teardown:', error);
  }
}

export default globalTeardown;

