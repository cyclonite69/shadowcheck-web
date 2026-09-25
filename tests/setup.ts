/**
 * Jest setup file
 * Runs before each test suite
 */

export {};

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DB_USER = process.env.DB_USER || 'shadowcheck_user';
process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'test_password';
process.env.DB_HOST = process.env.DB_HOST || 'localhost';
process.env.DB_PORT = process.env.DB_PORT || '5432';
process.env.DB_NAME = process.env.DB_NAME || 'shadowcheck_test';

// Hard stop: refuse to run against the production database.
// Mirrors the guard in tests/globalSetup.js. Defense-in-depth for test paths
// that bypass globalSetup (e.g. --testEnvironment or direct jest worker invocation).
if (process.env.DB_NAME !== 'shadowcheck_test') {
  throw new Error(
    `[setup.ts] Refusing to run tests against '${process.env.DB_NAME}'. Set DB_NAME=shadowcheck_test.`
  );
}

process.env.PORT = process.env.PORT || '3002'; // Different port for tests

// Increase timeout for database operations
jest.setTimeout(10000);

// Extend global type for test utilities
declare global {
  var sleep: (ms: number) => Promise<void>;
}

// Global test utilities
global.sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

// Suppress console output during tests (optional)
if (process.env.SILENT_TESTS === 'true') {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

// Clean up after all tests
afterAll(async () => {
  // Close any open database connections
  // Add cleanup logic here if needed
  await new Promise((resolve) => setTimeout(resolve, 500));
});
