import { initializeLifecycle } from '../../../server/src/utils/serverLifecycle';

// Mock dependencies
jest.mock('../../../server/src/services/featureFlagService', () => ({
  refreshCache: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../server/src/core/initialization/backgroundJobsInit', () => ({
  initializeBackgroundJobs: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../server/src/utils/shutdownHandlers', () => ({
  registerShutdownHandlers: jest.fn(),
}));

describe('serverLifecycle', () => {
  it('should initialize services and register handlers', async () => {
    const mockLogger: any = { info: jest.fn() };
    const mockPool: any = {};

    await initializeLifecycle({ logger: mockLogger, pool: mockPool });

    const featureFlagService = require('../../../server/src/services/featureFlagService');
    const {
      initializeBackgroundJobs,
    } = require('../../../server/src/core/initialization/backgroundJobsInit');
    const { registerShutdownHandlers } = require('../../../server/src/utils/shutdownHandlers');

    expect(featureFlagService.refreshCache).toHaveBeenCalled();
    expect(initializeBackgroundJobs).toHaveBeenCalled();
    expect(registerShutdownHandlers).toHaveBeenCalled();
  });
});
