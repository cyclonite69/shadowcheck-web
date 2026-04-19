import { initializeDatabaseConnection } from '../../../server/src/utils/databaseSetup';

// Mock dependencies
jest.mock('../../../server/src/config/database', () => ({
  pool: {},
  query: jest.fn(),
  testConnection: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../../server/src/core/initialization/databaseInit', () => ({
  initializeDatabase: jest.fn().mockResolvedValue(undefined),
}));

describe('databaseSetup', () => {
  it('should initialize database and return connection', async () => {
    const mockLogger: any = { info: jest.fn() };

    const result = await initializeDatabaseConnection(mockLogger);

    const { initializeDatabase } = require('../../../server/src/core/initialization/databaseInit');

    expect(initializeDatabase).toHaveBeenCalled();
    expect(result.pool).toBeDefined();
    expect(result.query).toBeDefined();
  });
});
