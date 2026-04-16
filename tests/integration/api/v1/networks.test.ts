import request from 'supertest';
import express from 'express';

// Define mock container
const mockContainer = {
  networkService: {
    getFilteredNetworks: jest.fn(),
  },
  networkListService: {
    searchNetworks: jest.fn(),
  },
  networkTagService: {},
  observationService: {},
  networkNotesAdminService: {},
};

// Mock the container
jest.mock('../../../../server/src/config/container', () => mockContainer);

// Mock logger
jest.mock('../../../../server/src/logging/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

// Mock cache middleware
jest.mock('../../../../server/src/middleware/cacheMiddleware', () => ({
  cacheMiddleware: () => (req: any, res: any, next: any) => next(),
}));

const networksRouter = require('../../../../server/src/api/routes/v1/networks/index');

const app = express();
app.use(express.json());
app.use('/api/v1', networksRouter);

describe('Networks API v1', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockContainer.networkService.getFilteredNetworks.mockResolvedValue({
      total: 1,
      rows: [
        {
          bssid: '00:11:22:33:44:55',
          ssid: 'TestNet',
          last_seen: new Date().toISOString(),
          threat_level: 'NONE',
          threat_score: 0,
        },
      ],
    });

    mockContainer.networkListService.searchNetworks.mockResolvedValue({
      total: 1,
      rows: [
        {
          bssid: '00:11:22:33:44:55',
          ssid: 'TestNet',
        },
      ],
    });
  });

  describe('GET /api/v1/networks', () => {
    it('should list networks with pagination', async () => {
      const res = await request(app).get('/api/v1/networks?limit=10&offset=0');
      
      expect(res.status).toBe(200);
      expect(res.body.rows).toBeDefined();
      expect(res.body.total).toBe(1);
      expect(res.body.rows[0].bssid).toBe('00:11:22:33:44:55');
    });

    it('should return 400 for missing limit', async () => {
      const res = await request(app).get('/api/v1/networks?offset=0');
      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });
  });

  describe('GET /api/v1/networks/search/:ssid', () => {
    it('should search networks by SSID', async () => {
      const res = await request(app).get('/api/v1/networks/search/TestNet');
      
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.networks).toBeDefined();
      expect(res.body.networks[0].ssid).toBe('TestNet');
    });
  });
});
