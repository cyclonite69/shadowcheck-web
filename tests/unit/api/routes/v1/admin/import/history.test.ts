import request from 'supertest';
import express from 'express';

// Mock import history service
const mockImportHistoryService = {
  getImportHistory: jest.fn(),
  getDeviceSources: jest.fn(),
};
const mockMobileIngestService = {
  startPendingUpload: jest.fn(),
  processUpload: jest.fn(),
};

jest.mock('../../../../../../../server/src/config/container', () => ({
  adminImportHistoryService: mockImportHistoryService,
  mobileIngestService: mockMobileIngestService,
}));

const historyRouter = require('../../../../../../../server/src/api/routes/v1/admin/import/history');

// Create test app
const app = express();
app.use(express.json());
app.use('/', historyRouter);

describe('import history routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /admin/import-history', () => {
    it('returns import history', async () => {
      mockImportHistoryService.getImportHistory.mockResolvedValue([
        { id: 1, source: 'wigle', timestamp: '2024-01-01T00:00:00Z' },
      ]);

      const response = await request(app).get('/admin/import-history?limit=1');

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.history).toHaveLength(1);
      expect(response.body.hasMore).toBe(false);
      expect(mockImportHistoryService.getImportHistory).toHaveBeenCalledWith(2, undefined);
    });

    it('reports when an older page is available', async () => {
      mockImportHistoryService.getImportHistory.mockResolvedValue([{ id: 2 }, { id: 1 }]);

      const response = await request(app).get('/admin/import-history?limit=1');

      expect(response.status).toBe(200);
      expect(response.body.history).toEqual([{ id: 2 }]);
      expect(response.body.hasMore).toBe(true);
    });

    it('passes a validated cursor to the service', async () => {
      mockImportHistoryService.getImportHistory.mockResolvedValue([]);

      const response = await request(app).get(
        '/admin/import-history?limit=10&beforeStartedAt=2026-10-01T12%3A00%3A00.000Z&beforeId=42'
      );

      expect(response.status).toBe(200);
      expect(mockImportHistoryService.getImportHistory).toHaveBeenCalledWith(11, {
        startedAt: '2026-10-01T12:00:00.000Z',
        id: 42,
      });
    });

    it('rejects incomplete or invalid cursors', async () => {
      const response = await request(app).get('/admin/import-history?beforeId=abc');

      expect(response.status).toBe(400);
      expect(mockImportHistoryService.getImportHistory).not.toHaveBeenCalled();
    });

    it('returns empty array when no history', async () => {
      mockImportHistoryService.getImportHistory.mockResolvedValue([]);

      const response = await request(app).get('/admin/import-history');

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.history).toEqual([]);
    });

    it('handles service errors', async () => {
      mockImportHistoryService.getImportHistory.mockRejectedValue(new Error('Database error'));

      const response = await request(app).get('/admin/import-history');

      expect(response.status).toBeGreaterThanOrEqual(500);
    });
  });

  describe('GET /admin/device-sources', () => {
    it('returns device sources', async () => {
      mockImportHistoryService.getDeviceSources.mockResolvedValue([
        { id: 1, name: 'Device1', type: 'mobile' },
      ]);

      const response = await request(app).get('/admin/device-sources');

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.sources).toHaveLength(1);
    });

    it('returns empty array when no sources', async () => {
      mockImportHistoryService.getDeviceSources.mockResolvedValue([]);

      const response = await request(app).get('/admin/device-sources');

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.sources).toEqual([]);
    });

    it('handles service errors', async () => {
      mockImportHistoryService.getDeviceSources.mockRejectedValue(new Error('Database error'));

      const response = await request(app).get('/admin/device-sources');

      expect(response.status).toBeGreaterThanOrEqual(500);
    });
  });
});
