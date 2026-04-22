describe('mobileIngestService - Visibility', () => {
  let mobileIngestService: any;
  let mockAdminQuery: any;
  let adminImportHistoryService: any;

  beforeEach(() => {
    jest.resetModules();

    // Setup mocks
    jest.mock('../../server/src/services/adminDbService', () => ({
      adminQuery: jest.fn().mockResolvedValue({ rows: [{ id: 1 }] }),
    }));

    jest.mock('../../server/src/services/adminImportHistoryService', () => ({
      captureImportMetrics: jest.fn().mockResolvedValue({ networks: 100 }),
      createImportHistoryEntry: jest.fn().mockResolvedValue(42),
      completeImportSuccess: jest.fn().mockResolvedValue(undefined),
    }));

    jest.mock('../../server/src/logging/logger', () => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    }));

    // Import after mocking
    mobileIngestService = require('../../server/src/services/mobileIngestService').default;
    const adminDb = require('../../server/src/services/adminDbService');
    mockAdminQuery = adminDb.adminQuery;
    adminImportHistoryService = require('../../server/src/services/adminImportHistoryService');
  });

  test('recordUpload creates an import_history entry immediately', async () => {
    const uploadData = {
      s3Key: 'uploads/test.sqlite',
      sourceTag: 'test_device',
      status: 'pending',
      historyStatus: 'pending',
    };

    await mobileIngestService.recordUpload(uploadData);

    // Verify DB record created
    expect(mockAdminQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO app.mobile_uploads'),
      expect.any(Array)
    );

    // Verify import history entry created
    expect(adminImportHistoryService.createImportHistoryEntry).toHaveBeenCalledWith(
      'test_device',
      'test.sqlite',
      { networks: 100 },
      'pending'
    );

    // Verify history_id is linked back to the upload
    expect(mockAdminQuery).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE app.mobile_uploads SET history_id = $1'),
      [42, 1]
    );
  });

  test('recordUpload defaults history rows to running when no override is provided', async () => {
    const uploadData = {
      s3Key: 'uploads/test.sqlite',
      sourceTag: 'test_device',
    };

    await mobileIngestService.recordUpload(uploadData);

    expect(adminImportHistoryService.createImportHistoryEntry).toHaveBeenCalledWith(
      'test_device',
      'test.sqlite',
      { networks: 100 },
      'running'
    );
    expect(adminImportHistoryService.completeImportSuccess).not.toHaveBeenCalled();
  });
});
