export {};

jest.mock('node-schedule', () => ({
  scheduleJob: jest.fn(),
}));

jest.mock('../../../../server/src/logging/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock('../../../../server/src/services/adminDbService', () => ({
  adminQuery: jest.fn(),
}));

jest.mock('../../../../server/src/repositories/jobRunRepository', () => ({
  getJobStatus: jest.fn(),
  trackJobRun: jest.fn().mockImplementation(async (name, task, context) => {
    return await task();
  }),
}));

jest.mock('../../../../server/src/services/backgroundJobs/settings', () => ({
  getResolvedJobConfig: jest.fn(),
  hasJobConfigChanged: jest.fn(),
  loadBackgroundJobConfigs: jest.fn(),
}));

jest.mock('../../../../server/src/services/backgroundJobs/mvRefresh', () => ({
  refreshMaterializedViews: jest.fn(),
}));

jest.mock('../../../../server/src/services/backgroundJobs/runners', () => ({
  runBackupJob: jest.fn(),
  runBehavioralMlScoringJob: jest.fn(),
  runSiblingDetectionJob: jest.fn(),
}));

jest.mock('../../../../server/src/services/featureFlagService', () => ({
  getFlag: jest.fn(),
}));

// We need to mock the config module too
jest.mock('../../../../server/src/services/backgroundJobs/config', () => ({
  BACKUP_CRON: '0 3 * * *',
  DEFAULT_JOB_CONFIGS: {
    backup: { enabled: true, cron: '0 3 * * *' },
    mlScoring: { enabled: true, cron: '0 */4 * * *' },
    mvRefresh: { enabled: true, cron: '30 4 * * *' },
    siblingDetection: { enabled: true, cron: '0 5 * * *' },
  },
  ML_SCORING_CRON: '0 */4 * * *',
  MV_REFRESH_CRON: '30 4 * * *',
}));

const BackgroundJobsService = require('../../../../server/src/services/backgroundJobsService');
const mockLogger = require('../../../../server/src/logging/logger');
const mockSchedule = require('node-schedule');
const mockSettings = require('../../../../server/src/services/backgroundJobs/settings');
const mockFeatureFlagService = require('../../../../server/src/services/featureFlagService');
const mockJobRunRepository = require('../../../../server/src/repositories/jobRunRepository');

describe('BackgroundJobsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset service state
    BackgroundJobsService.jobs = {};
    BackgroundJobsService.lastConfig = {};
    BackgroundJobsService.lastSchedulerEnabled = null;
    BackgroundJobsService.runningJobIds = {};
    BackgroundJobsService.initialized = false;

    mockFeatureFlagService.getFlag.mockReturnValue(true);
    mockSettings.loadBackgroundJobConfigs.mockResolvedValue({});
    mockSettings.getResolvedJobConfig.mockImplementation((configs: any, name: string) => ({
      enabled: true,
      cron: '0 0 * * *',
    }));
    mockSettings.hasJobConfigChanged.mockReturnValue(true);
  });

  describe('initialize', () => {
    it('should initialize and schedule jobs', async () => {
      await BackgroundJobsService.initialize();

      expect(BackgroundJobsService.initialized).toBe(true);
      expect(mockSchedule.scheduleJob).toHaveBeenCalled(); // poller + 4 jobs
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Initialization complete')
      );
    });

    it('should log error if DB fails during rescheduling', async () => {
      mockSettings.loadBackgroundJobConfigs.mockRejectedValue(new Error('DB Error'));

      await BackgroundJobsService.initialize();

      // Should still be initialized because rescheduleJobs catches its own error
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to reschedule jobs from database'),
        'DB Error'
      );
      expect(BackgroundJobsService.initialized).toBe(true);
      expect(mockSchedule.scheduleJob).toHaveBeenCalled();
    });
  });

  describe('concurrency locks', () => {
    it('should prevent running backup if already running', async () => {
      BackgroundJobsService.runningJobIds.backup = 123;
      await expect(BackgroundJobsService.runScheduledBackup()).rejects.toThrow(
        'backup job already running'
      );
    });

    it('should prevent running MV refresh if already running', async () => {
      BackgroundJobsService.runningJobIds.mvRefresh = 123;
      await expect(BackgroundJobsService.runMVRefresh()).rejects.toThrow(
        'materialized view refresh job already running'
      );
    });

    it('should prevent running ML scoring if already running', async () => {
      BackgroundJobsService.runningJobIds.mlScoring = 123;
      await expect(BackgroundJobsService.runMLScoring()).rejects.toThrow(
        'ML scoring job already running'
      );
    });

    it('should prevent running sibling detection if already running', async () => {
      BackgroundJobsService.runningJobIds.siblingDetection = 123;
      await expect(BackgroundJobsService.runSiblingDetection()).rejects.toThrow(
        'sibling detection job already running'
      );
    });
  });

  describe('shutdown', () => {
    it('should cancel all jobs and reset initialization state', () => {
      const mockJob = { cancel: jest.fn() };
      BackgroundJobsService.jobs = { job1: mockJob };
      BackgroundJobsService.initialized = true;

      BackgroundJobsService.shutdown();

      expect(mockJob.cancel).toHaveBeenCalled();
      expect(BackgroundJobsService.initialized).toBe(false);
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('All jobs cancelled'));
    });
  });

  describe('runJobNow', () => {
    it('should run backup job manually', async () => {
      const result = await BackgroundJobsService.runJobNow('backup');
      expect(result).toEqual({ jobName: 'backup', status: 'completed' });
      expect(mockJobRunRepository.trackJobRun).toHaveBeenCalledWith(
        'backup',
        expect.any(Function),
        expect.any(Object)
      );
    });

    it('should run ML scoring job manually', async () => {
      const result = await BackgroundJobsService.runJobNow('mlScoring');
      expect(result).toEqual({ jobName: 'mlScoring', status: 'completed' });
      expect(mockJobRunRepository.trackJobRun).toHaveBeenCalledWith(
        'mlScoring',
        expect.any(Function),
        expect.any(Object)
      );
    });

    it('should throw for unsupported job', async () => {
      await expect(BackgroundJobsService.runJobNow('invalid' as any)).rejects.toThrow(
        'Unsupported background job: invalid'
      );
    });
  });
});
