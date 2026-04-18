import request from 'supertest';
import express from 'express';

// Define the mock container object
const mockContainer = {
  threatScoringService: {
    getQuickThreats: jest.fn(),
    getDetailedThreats: jest.fn(),
  },
};

// Mock the container
jest.mock('../../../../server/src/config/container', () => mockContainer);

// Mock logger to prevent noise
jest.mock('../../../../server/src/logging/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

// Mock routeConfig
jest.mock('../../../../server/src/config/routeConfig', () => ({
  ROUTE_CONFIG: {
    minValidTimestamp: 0,
  },
}));

const threatsRouter = require('../../../../server/src/api/routes/v1/threats');

const app = express();
app.use(express.json());
app.use('/api/v1', threatsRouter);

describe('Threats API v1', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockContainer.threatScoringService.getQuickThreats.mockResolvedValue({
      threats: [
        {
          bssid: '00:11:22:33:44:55',
          ssid: 'ThreatNet',
          radioType: 'wifi',
          type: 'wifi',
          channel: 6,
          signal: -50,
          signalDbm: -50,
          maxSignal: -50,
          encryption: 'WPA2',
          latitude: 45.0,
          longitude: -75.0,
          firstSeen: '2026-04-01T00:00:00Z',
          lastSeen: '2026-04-02T00:00:00Z',
          observations: 10,
          totalObservations: 10,
          uniqueDays: 5,
          uniqueLocations: 8,
          distanceRangeKm: '1.50',
          threatScore: 85.5,
          threatLevel: 'high',
        },
      ],
      totalCount: 1,
    });

    mockContainer.threatScoringService.getDetailedThreats.mockResolvedValue([
      {
        bssid: '00:11:22:33:44:55',
        ssid: 'ThreatNet',
        type: 'wifi',
        encryption: 'WPA2',
        channel: 2437,
        signal: -50,
        signalDbm: -50,
        latitude: 45.0,
        longitude: -75.0,
        totalObservations: 10,
        observations: 10,
        threatScore: 85.5,
        threatType: 'High risk detected',
        threatLevel: 'high',
        confidence: '95',
        patterns: { metrics: {}, factors: {}, flags: ['MOCK_FLAG'] },
      },
    ]);
  });

  describe('GET /api/v1/threats/quick', () => {
    it('should return quick threats with pagination', async () => {
      const res = await request(app).get('/api/v1/threats/quick?limit=10&page=1');
      
      expect(res.status).toBe(200);
      expect(res.body.threats).toBeDefined();
      expect(res.body.threats.length).toBe(1);
      expect(res.body.threats[0].bssid).toBe('00:11:22:33:44:55');
      expect(res.body.total).toBe(1);
    });

    it('should respect custom thresholds', async () => {
      const res = await request(app).get('/api/v1/threats/quick?minObs=10&minScore=50');
      expect(res.status).toBe(200);
    });

    it('should return 400 for invalid parameters', async () => {
      const res = await request(app).get('/api/v1/threats/quick?minObs=invalid');
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/threats/detect', () => {
    it('should return detailed threats', async () => {
      const res = await request(app).get('/api/v1/threats/detect');
      
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.threats).toBeDefined();
      expect(res.body.threats[0].threatLevel).toBe('high');
      expect(res.body.threats[0].confidence).toBe('95');
    });
  });
});
