import request from 'supertest';
import express from 'express';

jest.mock('../../server/src/config/container', () => ({
  wigleService: {
    getWiglePageNetwork: jest.fn(),
    getWigleDetail: jest.fn(),
    searchWigleDatabase: jest.fn(),
    getWigleDatabase: jest.fn(),
    checkWigleV3TableExists: jest.fn(),
    getKmlPointsForMap: jest.fn(),
  },
}));

jest.mock('../../server/src/logging/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

jest.mock('../../server/src/utils/asyncHandler', () => ({
  asyncHandler: (fn: any) => (req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  },
}));

jest.mock('../../server/src/validation/middleware', () => ({
  macParamMiddleware: (req: any, res: any, next: any) => next(),
  validateQuery: (schema: any) => (req: any, res: any, next: any) => {
    req.validated = { ...req.query };
    next();
  },
  optional: (fn: any) => fn,
}));

jest.mock('../../server/src/validation/schemas', () => ({
  validateIntegerRange: (val: any) => ({ valid: true, value: parseInt(val, 10) }),
  validateString: (val: any) => ({ valid: true, value: val }),
}));

const { wigleService } = require('../../server/src/config/container');
const wigleDatabaseRouter = require('../../server/src/api/routes/v1/wigle/database').default;

const app = express();
app.use(express.json());
app.use('/api/wigle', wigleDatabaseRouter);
app.use((err: any, req: any, res: any, next: any) => {
  res.status(500).json({ error: err.message });
});

describe('wigle database routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/wigle/page/network/:netid', () => {
    it('should return wiGLE page network detail', async () => {
      wigleService.getWiglePageNetwork.mockResolvedValueOnce({ netid: '00:11:22:33:44:55' });
      const res = await request(app).get('/api/wigle/page/network/00:11:22:33:44:55');
      expect(res.status).toBe(200);
      expect(res.body.netid).toBe('00:11:22:33:44:55');
    });

    it('should return 404 if page network is not found', async () => {
      wigleService.getWiglePageNetwork.mockResolvedValueOnce(null);
      const res = await request(app).get('/api/wigle/page/network/00:11:22:33:44:55');
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/wigle/network/:bssid', () => {
    it('should return network detail', async () => {
      wigleService.getWigleDetail.mockResolvedValueOnce({ bssid: '00:11:22' });
      const res = await request(app).get('/api/wigle/network/00:11:22:33:44:55');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 404 if not found', async () => {
      wigleService.getWigleDetail.mockResolvedValueOnce(null);
      const res = await request(app).get('/api/wigle/network/00:11:22:33:44:55');
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/wigle/search', () => {
    it('should require ssid or bssid', async () => {
      const res = await request(app).get('/api/wigle/search');
      expect(res.status).toBe(400);
    });

    it('should search by ssid', async () => {
      wigleService.searchWigleDatabase.mockResolvedValueOnce([{ ssid: 'test' }]);
      const res = await request(app).get('/api/wigle/search?ssid=test');
      expect(res.status).toBe(200);
      expect(res.body.count).toBe(1);
    });
  });

  describe('GET /api/wigle/networks-v2', () => {
    it('should return networks', async () => {
      wigleService.getWigleDatabase.mockResolvedValueOnce({ rows: [], total: 0 });
      const res = await request(app).get('/api/wigle/networks-v2?limit=10&offset=0&type=WIFI');
      expect(res.status).toBe(200);
    });

    it('should reject invalid include_total', async () => {
      const res = await request(app).get('/api/wigle/networks-v2?include_total=abc');
      expect(res.status).toBe(400);
    });

    it('should apply filters', async () => {
      wigleService.getWigleDatabase.mockResolvedValueOnce({ rows: [], total: 0 });
      const filters = JSON.stringify({ ssid: 'test', bssid: 'test2' });
      const enabled = JSON.stringify({ ssid: true, bssid: true });
      const res = await request(app).get(
        `/api/wigle/networks-v2?filters=${filters}&enabled=${enabled}`
      );
      expect(res.status).toBe(200);
      expect(wigleService.getWigleDatabase).toHaveBeenCalledWith(
        expect.objectContaining({
          ssid: 'test',
          bssid: 'test2',
        })
      );
    });
  });

  describe('GET /api/wigle/networks-v3', () => {
    it('should return message if v3 not available', async () => {
      wigleService.checkWigleV3TableExists.mockResolvedValueOnce(false);
      const res = await request(app).get('/api/wigle/networks-v3');
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('WiGLE v3 networks table not available');
    });

    it('should return networks if v3 available', async () => {
      wigleService.checkWigleV3TableExists.mockResolvedValueOnce(true);
      wigleService.getWigleDatabase.mockResolvedValueOnce({ rows: [], total: 0 });
      const res = await request(app).get('/api/wigle/networks-v3?limit=10');
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/wigle/kml-points', () => {
    it('should return kml points', async () => {
      wigleService.getKmlPointsForMap.mockResolvedValueOnce({ rows: [], total: 0 });
      const res = await request(app).get('/api/wigle/kml-points');
      expect(res.status).toBe(200);
    });

    it('should apply filters', async () => {
      wigleService.getKmlPointsForMap.mockResolvedValueOnce({ rows: [], total: 0 });
      const filters = JSON.stringify({ bssid: 'test' });
      const enabled = JSON.stringify({ bssid: true });
      const res = await request(app).get(
        `/api/wigle/kml-points?filters=${filters}&enabled=${enabled}`
      );
      expect(res.status).toBe(200);
      expect(wigleService.getKmlPointsForMap).toHaveBeenCalledWith(
        expect.objectContaining({
          bssid: 'test',
        })
      );
    });
  });
});
