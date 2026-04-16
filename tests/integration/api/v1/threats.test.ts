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
      rows: [
        {
          bssid: '00:11:22:33:44:55',
          ssid: 'ThreatNet',
          radio_type: 'wifi',
          channel: 6,
          signal_dbm: -50,
          encryption: 'WPA2',
          latitude: 45.0,
          longitude: -75.0,
          observations: '10',
          unique_days: '5',
          unique_locations: '8',
          distance_range_km: '1.5',
          threat_score: '85.5',
          threat_level: 'HIGH',
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
        frequency: 2437,
        signal_dbm: -50,
        network_latitude: 45.0,
        network_longitude: -75.0,
        total_observations: 10,
        final_threat_score: '85.5',
        final_threat_level: 'HIGH',
        rule_based_flags: {
          summary: 'High risk detected',
          confidence: '0.95',
          metrics: {},
          factors: {},
          flags: ['MOCK_FLAG'],
        },
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
