/**
 * Mobile Ingest Service Unit Tests
 */

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import { pipeline } from 'stream/promises';
import mobileIngestService from '../../server/src/services/mobileIngestService';
const { adminQuery } = require('../../server/src/services/adminDbService');
const adminImportHistoryService = require('../../server/src/services/adminImportHistoryService');
import logger from '../../server/src/logging/logger';
import { IncrementalImporter } from '../../etl/load/sqlite-import';

jest.mock('@aws-sdk/client-s3');
jest.mock('stream/promises', () => ({
  pipeline: jest.fn(),
}));
jest.mock('../../server/src/services/adminDbService');
jest.mock('../../server/src/services/adminImportHistoryService');
jest.mock('../../server/src/logging/logger');
jest.mock('../../etl/load/sqlite-import');
jest.mock('../../server/src/services/secretsManager', () => ({
  get: jest.fn().mockReturnValue('mock-secret'),
  getOrThrow: jest.fn().mockReturnValue('mock-secret'),
}));

import { Writable } from 'stream';

describe('MobileIngestService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (mobileIngestService as any).s3Client = null; // Reset S3 client for tests
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('recordUpload', () => {
    it('should record an upload and create history entry', async () => {
      (adminQuery as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ id: 100 }] })
        .mockResolvedValueOnce({});
      adminImportHistoryService.captureImportMetrics.mockResolvedValueOnce({ rows: 10 });
      adminImportHistoryService.createImportHistoryEntry.mockResolvedValueOnce(200);

      const uploadData = {
        s3Key: 'test/file.sqlite',
        sourceTag: 'test-device',
        deviceModel: 'iPhone 13',
        deviceId: 'device-123',
        osVersion: '15.0',
        appVersion: '1.0.0',
        batteryLevel: 80,
        storageFreeGb: 10,
        extraMetadata: { foo: 'bar' },
      };

      const result = await mobileIngestService.recordUpload(uploadData);

      expect(result).toBe(100);
      expect(adminQuery).toHaveBeenCalledTimes(2); // INSERT upload, UPDATE history_id
      expect(adminQuery).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('INSERT INTO app.mobile_uploads'),
        expect.arrayContaining([
          'test/file.sqlite',
          'test-device',
          'iPhone 13',
          'device-123',
          '15.0',
          '1.0.0',
          80,
          10,
          JSON.stringify({ foo: 'bar' }),
          'pending',
        ])
      );
      expect(adminImportHistoryService.createImportHistoryEntry).toHaveBeenCalledWith(
        'test-device',
        'file.sqlite',
        { rows: 10 }
      );
      expect(adminImportHistoryService.completeImportSuccess).not.toHaveBeenCalled();
    });

    it('should handle quarantined status by marking history as complete immediately', async () => {
      (adminQuery as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ id: 100 }] })
        .mockResolvedValueOnce({});
      adminImportHistoryService.captureImportMetrics.mockResolvedValueOnce({ rows: 10 });
      adminImportHistoryService.createImportHistoryEntry.mockResolvedValueOnce(200);

      await mobileIngestService.recordUpload({
        s3Key: 'test/file.sqlite',
        sourceTag: 'test-device',
        status: 'quarantined',
      });

      expect(adminImportHistoryService.completeImportSuccess).toHaveBeenCalledWith(
        200,
        0,
        0,
        '0.00',
        { rows: 10 },
        'quarantined'
      );
    });

    it('should ignore errors during history entry creation and still return DB ID', async () => {
      (adminQuery as jest.Mock).mockResolvedValueOnce({ rows: [{ id: 100 }] });
      adminImportHistoryService.captureImportMetrics.mockRejectedValueOnce(
        new Error('History DB error')
      );

      const result = await mobileIngestService.recordUpload({
        s3Key: 'test/file.sqlite',
        sourceTag: 'test-device',
      });

      expect(result).toBe(100);
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('History DB error'));
    });
  });

  describe('processUpload', () => {
    it('should throw an error if upload is not found', async () => {
      (adminQuery as jest.Mock).mockResolvedValueOnce({ rows: [] });

      await expect(mobileIngestService.processUpload(100)).rejects.toThrow('Upload 100 not found');
    });

    it('should process upload successfully from download to import', async () => {
      const mockUpload = {
        id: 100,
        s3_key: 'test/file.sqlite',
        source_tag: 'test-device',
        history_id: 200,
      };
      (adminQuery as jest.Mock)
        .mockResolvedValueOnce({ rows: [mockUpload] }) // SELECT upload
        .mockResolvedValueOnce({}) // UPDATE status processing
        .mockResolvedValueOnce({}) // UPDATE import_history running
        .mockResolvedValueOnce({}); // UPDATE status completed

      const mockS3Send = jest.fn().mockResolvedValueOnce({ Body: 'mock-stream' });
      (S3Client as unknown as jest.Mock).mockImplementation(() => ({ send: mockS3Send }));

      const mockMetricsBefore = { count: 0 };
      const mockMetricsAfter = { count: 100 };
      adminImportHistoryService.captureImportMetrics
        .mockResolvedValueOnce(mockMetricsBefore)
        .mockResolvedValueOnce(mockMetricsAfter);

      const mockStart = jest.fn().mockResolvedValue({ imported: 50, failed: 5, durationS: 10.5 });
      (IncrementalImporter as unknown as jest.Mock).mockImplementation(() => ({
        start: mockStart,
      }));

      await mobileIngestService.processUpload(100);

      // Verify S3 Client initialization and call
      expect(S3Client).toHaveBeenCalled();
      expect(mockS3Send).toHaveBeenCalledWith(expect.any(GetObjectCommand));
      expect(pipeline).toHaveBeenCalledWith('mock-stream', expect.anything());

      // Verify history update since history_id is present
      expect(adminQuery).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE app.import_history SET status = 'running'"),
        [JSON.stringify(mockMetricsBefore), 200]
      );

      // Verify importer start
      expect(mockStart).toHaveBeenCalled();

      // Verify success completion
      expect(adminImportHistoryService.completeImportSuccess).toHaveBeenCalledWith(
        200,
        50,
        5,
        '10.50',
        mockMetricsAfter
      );

      // Verify final upload update
      expect(adminQuery).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE app.mobile_uploads SET status = 'completed'"),
        [200, 100]
      );
    });

    it('should create new history entry if upload.history_id is missing', async () => {
      const mockUpload = {
        id: 100,
        s3_key: 'test/file.sqlite',
        source_tag: 'test-device',
        history_id: null,
      };
      (adminQuery as jest.Mock).mockResolvedValueOnce({ rows: [mockUpload] }).mockResolvedValue({});
      (S3Client as unknown as jest.Mock).mockImplementation(() => ({
        send: jest.fn().mockResolvedValue({ Body: 'mock-stream' }),
      }));
      adminImportHistoryService.captureImportMetrics.mockResolvedValue({});
      adminImportHistoryService.createImportHistoryEntry.mockResolvedValueOnce(300);
      (IncrementalImporter as unknown as jest.Mock).mockImplementation(() => ({
        start: jest.fn().mockResolvedValue({ imported: 0, failed: 0, durationS: 0 }),
      }));

      await mobileIngestService.processUpload(100);

      expect(adminImportHistoryService.createImportHistoryEntry).toHaveBeenCalledWith(
        'test-device',
        'file.sqlite',
        expect.anything()
      );
    });

    it('should handle missing S3 response body', async () => {
      const mockUpload = {
        id: 100,
        s3_key: 'test/file.sqlite',
        source_tag: 'test-device',
        history_id: 200,
      };
      (adminQuery as jest.Mock).mockResolvedValueOnce({ rows: [mockUpload] }).mockResolvedValue({});
      (S3Client as unknown as jest.Mock).mockImplementation(() => ({
        send: jest.fn().mockResolvedValue({}),
      })); // no Body

      await mobileIngestService.processUpload(100);

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('S3 response body is empty'),
        expect.any(Object)
      );
      expect(adminQuery).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE app.mobile_uploads SET status = 'failed'"),
        ['S3 response body is empty', 100]
      );
      // failImportHistory won't be called because historyId is 0 when the error is thrown
      expect(adminImportHistoryService.failImportHistory).not.toHaveBeenCalled();
    });

    it('should catch errors during processing and fail gracefully', async () => {
      const mockUpload = {
        id: 100,
        s3_key: 'test/file.sqlite',
        source_tag: 'test-device',
        history_id: null,
      };
      (adminQuery as jest.Mock).mockResolvedValueOnce({ rows: [mockUpload] }).mockResolvedValue({});
      (S3Client as unknown as jest.Mock).mockImplementation(() => ({
        send: jest.fn().mockRejectedValue(new Error('S3 Download Failed')),
      }));

      await mobileIngestService.processUpload(100);

      expect(adminQuery).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE app.mobile_uploads SET status = 'failed'"),
        ['S3 Download Failed', 100]
      );
    });

    it('should fail if bucketName is missing', async () => {
      // Set bucketName to null directly to trigger the error check at the start of processUpload
      (mobileIngestService as any).bucketName = null;
      // Also need to mock initS3 to prevent it from resetting bucketName
      const initS3Spy = jest
        .spyOn(mobileIngestService as any, 'initS3')
        .mockImplementation(() => {});

      // The service throws an error that is NOT caught inside the method if it's before the try-catch block
      await expect(mobileIngestService.processUpload(100)).rejects.toThrow(
        'S3_BACKUP_BUCKET not configured'
      );

      initS3Spy.mockRestore();
    });

    it('should skip S3 client init if already initialized', async () => {
      (mobileIngestService as any).s3Client = { send: jest.fn() };
      (mobileIngestService as any).bucketName = 'existing-bucket';
      const mockUpload = { id: 100, s3_key: 'test.sqlite' };
      (adminQuery as jest.Mock).mockResolvedValueOnce({ rows: [mockUpload] }).mockResolvedValue({});

      await mobileIngestService.processUpload(100);
      expect(S3Client).not.toHaveBeenCalled();
    });
  });
});
