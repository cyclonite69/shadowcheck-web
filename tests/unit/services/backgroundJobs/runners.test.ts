jest.mock('../../../../server/src/logging/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock('../../../../server/src/services/backupService', () => ({
  runPostgresBackup: jest.fn(),
}));

jest.mock('../../../../server/src/services/ml/repository', () => ({
  getNetworksForBehavioralScoring: jest.fn(),
  bulkUpsertThreatScores: jest.fn(),
}));

jest.mock('../../../../server/src/services/networkTagService', () => ({
  getManualThreatTags: jest.fn(),
}));

jest.mock('../../../../server/src/services/ouiGroupingService', () => ({
  generateOUIGroups: jest.fn(),
  detectMACRandomization: jest.fn(),
}));

jest.mock('../../../../server/src/services/adminDbService', () => ({
  adminQuery: jest.fn(),
}));

jest.mock('../../../../server/src/services/backgroundJobs/mlBehavioralScoring', () => ({
  scoreBehavioralThreats: jest.fn(),
}));

import {
  runBackupJob,
  runBehavioralMlScoringJob,
  runSiblingDetectionJob,
} from '../../../../server/src/services/backgroundJobs/runners';
const mockLogger = require('../../../../server/src/logging/logger');
const mockBackupService = require('../../../../server/src/services/backupService');
const mockMlScoringRepository = require('../../../../server/src/services/ml/repository');
const mockNetworkTagService = require('../../../../server/src/services/networkTagService');
const mockOUIGroupingService = require('../../../../server/src/services/ouiGroupingService');
const mockAdminDbService = require('../../../../server/src/services/adminDbService');
const mockMlBehavioralScoring = require('../../../../server/src/services/backgroundJobs/mlBehavioralScoring');

describe('runners service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('runBackupJob', () => {
    it('should run backup successfully and report S3 upload', async () => {
      mockBackupService.runPostgresBackup.mockResolvedValue({
        files: [{ type: 'database', name: 'db.sql', bytes: 1000 }],
        s3: [{ type: 'database', url: 'https://s3/db.sql' }],
        fileName: 'db.sql',
        bytes: 1000,
      });

      const result = await runBackupJob();

      expect(result.fileName).toBe('db.sql');
      expect(result.s3Url).toBe('https://s3/db.sql');
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Complete: db.sql (1000 bytes) uploaded to https://s3/db.sql')
      );
    });

    it('should handle backup with no files or S3 result', async () => {
      mockBackupService.runPostgresBackup.mockResolvedValue({
        files: null,
        s3: null,
      });

      const result = await runBackupJob();

      expect(result.fileName).toBeNull();
      expect(result.bytes).toBeNull();
      expect(result.s3Url).toBeNull();
    });

    it('should use first file if no database type found', async () => {
      mockBackupService.runPostgresBackup.mockResolvedValue({
        files: [{ type: 'other', name: 'other.sql', bytes: 500 }],
        s3: [{ type: 'other', url: 'https://s3/other.sql' }],
      });

      const result = await runBackupJob();

      expect(result.fileName).toBe('other.sql');
      expect(result.s3Url).toBe('https://s3/other.sql');
    });

    it('should handle S3 upload failure', async () => {
      mockBackupService.runPostgresBackup.mockResolvedValue({
        files: [{ type: 'database', name: 'db.sql', bytes: 1000 }],
        fileName: 'db.sql',
        bytes: 1000,
        s3Error: 'S3 Error',
      });

      const result = await runBackupJob();

      expect(result.s3Error).toBe('S3 Error');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Backup created locally (db.sql) but S3 upload failed: S3 Error')
      );
    });
  });

  describe('runBehavioralMlScoringJob', () => {
    it('should run ML scoring job successfully', async () => {
      const mockNetworks = [{ bssid: '11:22:33:44:55:66' }];
      const mockTags = [{ bssid: '11:22:33:44:55:66', tag: 'threat' }];
      const mockScores = [{ bssid: '11:22:33:44:55:66', score: 0.8 }];
      const mockTagMap = new Map([['11:22:33:44:55:66', 'threat']]);

      mockMlScoringRepository.getNetworksForBehavioralScoring.mockResolvedValue(mockNetworks);
      mockNetworkTagService.getManualThreatTags.mockResolvedValue(mockTags);
      mockMlBehavioralScoring.scoreBehavioralThreats.mockReturnValue({
        scores: mockScores,
        tagMap: mockTagMap,
      });
      mockMlScoringRepository.bulkUpsertThreatScores.mockResolvedValue(1);

      const result = await runBehavioralMlScoringJob();

      expect(result.analyzedNetworks).toBe(1);
      expect(result.insertedScores).toBe(1);
      expect(result.feedbackTaggedNetworks).toBe(1);
      expect(mockOUIGroupingService.generateOUIGroups).toHaveBeenCalled();
      expect(mockOUIGroupingService.detectMACRandomization).toHaveBeenCalled();
    });
  });

  describe('runSiblingDetectionJob', () => {
    it('should run sibling detection with default options', async () => {
      mockAdminDbService.adminQuery.mockResolvedValue({
        rows: [{ count: '5' }],
      });

      const result = await runSiblingDetectionJob();

      expect(result.pairsProcessed).toBe(5);
      expect(mockAdminDbService.adminQuery).toHaveBeenCalledWith(
        expect.stringContaining('app.refresh_network_sibling_pairs'),
        [6, 5000, 0.7, 1000, true]
      );
    });

    it('should run sibling detection with custom options', async () => {
      mockAdminDbService.adminQuery.mockResolvedValue({
        rows: [{ count: '10' }],
      });

      const result = await runSiblingDetectionJob({
        max_octet_delta: 4,
        max_distance_m: 2000,
        min_candidate_conf: 0.8,
        seed_limit: 500,
        incremental: false,
      });

      expect(result.pairsProcessed).toBe(10);
      expect(mockAdminDbService.adminQuery).toHaveBeenCalledWith(
        expect.stringContaining('app.refresh_network_sibling_pairs'),
        [4, 2000, 0.8, 500, false]
      );
    });

    it('should use default values for sibling detection options', async () => {
      mockAdminDbService.adminQuery.mockResolvedValue({
        rows: [{ count: '0' }],
      });

      await runSiblingDetectionJob({});

      expect(mockAdminDbService.adminQuery).toHaveBeenCalledWith(
        expect.stringContaining('app.refresh_network_sibling_pairs'),
        [6, 5000, 0.7, 1000, true]
      );
    });
  });
});
