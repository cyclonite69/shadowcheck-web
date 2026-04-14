import { initializeBackgroundJobs } from '../../../server/src/utils/backgroundJobsInit';

jest.mock('../../../server/src/services/featureFlagService', () => ({
  getFlag: jest.fn(),
}));
jest.mock('../../../server/src/services/backgroundJobsService', () => ({
  initialize: jest.fn(),
}));

const featureFlagService = require('../../../server/src/services/featureFlagService');
const BackgroundJobsService = require('../../../server/src/services/backgroundJobsService');

describe('backgroundJobsInit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize background jobs if feature flag is enabled', async () => {
    featureFlagService.getFlag.mockReturnValue(true);
    BackgroundJobsService.initialize.mockResolvedValue(undefined);

    await initializeBackgroundJobs();

    expect(featureFlagService.getFlag).toHaveBeenCalledWith('enable_background_jobs');
    expect(BackgroundJobsService.initialize).toHaveBeenCalled();
  });

  it('should skip background job initialization if feature flag is disabled', async () => {
    featureFlagService.getFlag.mockReturnValue(false);

    await initializeBackgroundJobs();

    expect(featureFlagService.getFlag).toHaveBeenCalledWith('enable_background_jobs');
    expect(BackgroundJobsService.initialize).not.toHaveBeenCalled();
  });
});
