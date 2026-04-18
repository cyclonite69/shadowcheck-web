/** @type {import('jest').Config} */
module.exports = {
  // Test environment
  testEnvironment: 'node',

  // Test match patterns
  testMatch: ['**/tests/**/*.test.{js,ts}', '**/__tests__/**/*.test.{js,ts}', '**/*.spec.{js,ts}'],

  // Coverage configuration
  collectCoverage: false, // Enable with --coverage flag
  collectCoverageFrom: [
    'server/src/**/*.{js,ts}',
    'server/server.js',
    'scripts/**/*.{js,ts}',
    'etl/**/*.ts',
    '!**/node_modules/**',
    '!**/tests/**',
    '!**/__tests__/**',
    '!**/coverage/**',
  ],

  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 43,
      functions: 47,
      lines: 54,
      statements: 52,
    },
  },

  // Coverage reporters
  coverageReporters: ['text', 'text-summary', 'html', 'lcov', 'json'],

  // Coverage directory
  coverageDirectory: 'coverage',

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],

  // Module paths
  modulePaths: ['<rootDir>'],

  // Clear mocks between tests
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,

  // Verbose output
  verbose: true,

  // Timeout
  testTimeout: 10000,

  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/data/',
    '/docs/',
    '/scripts/manual/',
    '<rootDir>/client/',
    '/client/',
    '<rootDir>/.claude/',
    '__tests__',
  ],

  modulePathIgnorePatterns: ['<rootDir>/.claude/'],

  // Transform - Add TypeScript support
  preset: 'ts-jest',
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json' }],
    '^.+\\.js$': 'babel-jest',
  },

  // Module file extensions
  moduleFileExtensions: ['js', 'ts', 'tsx', 'json'],

  // Global setup/teardown
  // globalSetup: '<rootDir>/tests/globalSetup.js',
  // globalTeardown: '<rootDir>/tests/globalTeardown.js',

  // Force exit after tests
  forceExit: true,

  // Detect open handles
  detectOpenHandles: true,

  // Max workers for parallel execution
  maxWorkers: '50%',
};
