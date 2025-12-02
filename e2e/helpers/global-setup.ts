import { seedTestUsers } from './db';

/**
 * Global setup for E2E tests
 * Runs once before all tests
 */
async function globalSetup() {
  console.log('Setting up E2E test environment...');
  
  // Seed test users
  try {
    await seedTestUsers();
    console.log('Test users seeded successfully');
  } catch (error) {
    console.error('Failed to seed test users:', error);
    throw error;
  }
}

export default globalSetup;

