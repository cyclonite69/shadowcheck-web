import request from 'supertest';
import express from 'express';

// Mock container first
const mockGetWigleObservations = jest.fn();
jest.mock('../../../../../../server/src/config/container', () => ({
  wigleService: {
    getWigleObservations: mockGetWigleObservations,
  },
}));

// Mock logger to avoid noise
jest.mock('../../../../../../server/src/logging/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

import observationsRouter from '../../../../../../server/src/api/routes/v1/wigle/observations';

const app = express();
app.use(express.json());
app.use('/', observationsRouter);
// Simple error handler to prevent crashing tests
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(500).json({ error: err.message });
});

describe('WiGLE Observations Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /observations/:netid', () => {
    it('returns observations with default limit and offset', async () => {
      mockGetWigleObservations.mockResolvedValue({
        rows: [{ id: 1, lat: 40, lon: -70 }],
        total: 1,
      });

      const response = await request(app).get('/observations/AA:BB:CC:DD:EE:FF');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        ok: true,
        count: 1,
        total: 1,
        observations: [{ id: 1, lat: 40, lon: -70 }],
      });
      expect(mockGetWigleObservations).toHaveBeenCalledWith('AA:BB:CC:DD:EE:FF', null, null);
    });

    it('returns observations with custom limit and offset', async () => {
      mockGetWigleObservations.mockResolvedValue({
        rows: [{ id: 2, lat: 41, lon: -71 }],
        total: 10,
      });

      const response = await request(app).get('/observations/AA:BB:CC:DD:EE:FF?limit=50&offset=10');

      expect(response.status).toBe(200);
      expect(response.body.observations).toHaveLength(1);
      expect(mockGetWigleObservations).toHaveBeenCalledWith('AA:BB:CC:DD:EE:FF', 50, 10);
    });

    it('returns validation error for invalid limit', async () => {
      const response = await request(app).get('/observations/AA:BB:CC:DD:EE:FF?limit=-1');

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it('handles service errors gracefully', async () => {
      mockGetWigleObservations.mockRejectedValue(new Error('DB Error'));

      const response = await request(app).get('/observations/AA:BB:CC:DD:EE:FF');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('DB Error');
    });
  });
});
