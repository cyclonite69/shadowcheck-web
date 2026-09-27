import express from 'express';
import request from 'supertest';

// Mock auth middleware
jest.mock('../../server/src/middleware/authMiddleware', () => ({
  requireAdmin: (req: any, res: any, next: any) => next(),
}));

// Mock database config
const mockQuery = jest.fn();
jest.mock('../../server/src/config/database', () => ({
  query: (...args: any[]) => mockQuery(...args),
}));

// Mock services
const mockFetchOrImportDetail = jest.fn();
const mockImportDetailFromJson = jest.fn();
jest.mock('../../server/src/services/wigleDetailService', () => {
  const actual = jest.requireActual('../../server/src/services/wigleDetailService');
  return {
    ...actual,
    fetchOrImportDetail: (...args: any[]) => mockFetchOrImportDetail(...args),
    importDetailFromJson: (...args: any[]) => mockImportDetailFromJson(...args),
  };
});

const mockInferWigleEndpoint = jest.fn();
jest.mock('../../server/src/services/wigleDetailTransforms', () => ({
  inferWigleEndpoint: (...args: any[]) => mockInferWigleEndpoint(...args),
}));

const detailRouter = require('../../server/src/api/routes/v1/wigle/detail').default;

const app = express();
app.use(express.json());
app.use('/api', detailRouter);

describe('WiGLE Detail & Import Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /detail/batch', () => {
    it('returns 400 if bssids is not an array or is empty', async () => {
      const res1 = await request(app).post('/api/detail/batch').send({ bssids: 'not-an-array' });
      expect(res1.status).toBe(400);

      const res2 = await request(app).post('/api/detail/batch').send({ bssids: [] });
      expect(res2.status).toBe(400);
    });

    it('processes batch of BSSIDs successfully', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          { bssid: 'AA:BB:CC:DD:EE:FF', type: 'W' },
          { bssid: '11:22:33:44:55:66', type: 'E' },
        ],
      });
      mockInferWigleEndpoint.mockReturnValueOnce('wifi').mockReturnValueOnce('bt');
      mockFetchOrImportDetail
        .mockResolvedValueOnce({ ok: true, importedObservations: 5 })
        .mockResolvedValueOnce({ ok: false, error: 'WiGLE API rate limit' });

      const res = await request(app)
        .post('/api/detail/batch')
        .send({ bssids: ['AA:BB:CC:DD:EE:FF', '11:22:33:44:55:66'], import: true });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);

      expect(mockQuery).toHaveBeenCalled();
      const [sqlQuery, sqlParams] = mockQuery.mock.calls[0];
      expect(sqlParams).toEqual([['AA:BB:CC:DD:EE:FF', '11:22:33:44:55:66']]);
      expect(sqlQuery).toContain('SELECT DISTINCT ON (bssid)');
      expect(sqlQuery).toContain('bssid');
      expect(sqlQuery).toContain('type');
      expect(sqlQuery).toContain('FROM app.networks');
      expect(sqlQuery).toContain('WHERE bssid = ANY($1::text[])');
      expect(sqlQuery).toContain('ORDER BY bssid, type');

      expect(res.body.results).toEqual([
        { bssid: 'AA:BB:CC:DD:EE:FF', success: true, importedObservations: 5 },
        { bssid: '11:22:33:44:55:66', success: false, error: 'WiGLE API rate limit' },
      ]);
      expect(res.body.summary).toEqual({
        total: 2,
        succeeded: 1,
        failed: 1,
        totalImported: 5,
      });
    });

    it('returns 400 if cleanBssids length is 0 after filtering', async () => {
      const res = await request(app)
        .post('/api/detail/batch')
        .send({ bssids: [123, null] });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('No valid BSSIDs provided');
    });
  });

  describe('POST /detail/:netid', () => {
    it('calls fetchOrImportDetail for wifi and returns status', async () => {
      mockFetchOrImportDetail.mockResolvedValueOnce({ ok: true, detail: 'some-detail' });
      const res = await request(app).post('/api/detail/NET123').send({ import: true });
      expect(res.status).toBe(200);
      expect(mockFetchOrImportDetail).toHaveBeenCalledWith('NET123', 'wifi', true);
    });

    it('returns error status if fetchOrImportDetail fails', async () => {
      mockFetchOrImportDetail.mockResolvedValueOnce({ ok: false, status: 404, error: 'not found' });
      const res = await request(app).post('/api/detail/NET123');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('not found');
    });
  });

  describe('POST /detail/bt/:netid', () => {
    it('calls fetchOrImportDetail for bt and returns status', async () => {
      mockFetchOrImportDetail.mockResolvedValueOnce({ ok: true, detail: 'some-detail-bt' });
      const res = await request(app).post('/api/detail/bt/NET123').send({ import: false });
      expect(res.status).toBe(200);
      expect(mockFetchOrImportDetail).toHaveBeenCalledWith('NET123', 'bt', false);
    });
  });

  describe('POST /import/v3', () => {
    it('returns 400 if no file uploaded', async () => {
      const res = await request(app).post('/api/import/v3');
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('No file uploaded');
    });

    it('returns 400 if file is invalid JSON', async () => {
      // Mocking express-fileupload req.files behavior
      const mockExpressApp = express();
      mockExpressApp.use(express.json());
      // Custom middleware to inject invalid file
      mockExpressApp.use((req: any, res: any, next: any) => {
        req.files = {
          file: {
            data: Buffer.from('invalid-json-content'),
            name: 'test.json',
          },
        };
        next();
      });
      mockExpressApp.use('/api', detailRouter);

      const res = await request(mockExpressApp).post('/api/import/v3');
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid JSON file');
    });

    it('returns 400 if JSON is missing networkId', async () => {
      const mockExpressApp = express();
      mockExpressApp.use((req: any, res: any, next: any) => {
        req.files = {
          file: {
            data: Buffer.from('{"some":"data"}'),
            name: 'test.json',
          },
        };
        next();
      });
      mockExpressApp.use('/api', detailRouter);

      const res = await request(mockExpressApp).post('/api/import/v3');
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('missing networkId');
    });

    it('imports successfully if valid JSON with networkId is uploaded', async () => {
      const mockExpressApp = express();
      mockExpressApp.use((req: any, res: any, next: any) => {
        req.files = {
          file: {
            data: Buffer.from('{"networkId":"NET123"}'),
            name: 'test.json',
          },
        };
        next();
      });
      mockExpressApp.use('/api', detailRouter);

      mockImportDetailFromJson.mockResolvedValueOnce({ ok: true, imported: true });

      const res = await request(mockExpressApp).post('/api/import/v3');
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(mockImportDetailFromJson).toHaveBeenCalledWith({ networkId: 'NET123' });
    });
  });
});
