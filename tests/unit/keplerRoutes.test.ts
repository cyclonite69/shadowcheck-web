import express from 'express';
import request from 'supertest';

const keplerService = {
  getKeplerData: jest.fn(),
  getKeplerObservations: jest.fn(),
  streamKeplerObservations: jest.fn(),
  streamKeplerObservationsArrow: jest.fn(),
  getKeplerNetworks: jest.fn(),
};

const logger = {
  error: jest.fn(),
};

jest.mock('../../server/src/config/container', () => ({
  keplerService,
}));

jest.mock('../../server/src/logging/logger', () => logger);

const keplerRouter = require('../../server/src/api/routes/v1/kepler');

const app = express();
app.use(express.json());
app.use('/api', keplerRouter);
app.use((error: Error, _req: unknown, res: express.Response, _next: express.NextFunction) => {
  res.status(500).json({ error: error.message });
});

describe('kepler routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /kepler/data', () => {
    it('returns kepler data successfully', async () => {
      keplerService.getKeplerData.mockResolvedValueOnce({
        type: 'FeatureCollection',
        features: [],
      });

      const res = await request(app)
        .get('/api/kepler/data')
        .query({ filters: '{"type":"W"}', enabled: '{"type":true}', limit: '10', offset: '20' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ type: 'FeatureCollection', features: [] });
      expect(keplerService.getKeplerData).toHaveBeenCalledWith(
        { type: 'W' },
        { type: true },
        10,
        20
      );
    });

    it('returns 400 when invalid JSON is provided for filters or enabled', async () => {
      const res = await request(app).get('/api/kepler/data').query({ filters: 'invalid-json' });

      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.errors).toContain('Invalid JSON for filters');
    });

    it('returns custom status and message on service failure with status', async () => {
      const error: any = new Error('Service error');
      error.status = 403;
      keplerService.getKeplerData.mockRejectedValueOnce(error);

      const res = await request(app).get('/api/kepler/data');
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Service error');
    });
  });

  describe('GET /kepler/observations', () => {
    it('delegates to streamKeplerObservations successfully', async () => {
      keplerService.streamKeplerObservations.mockImplementation(async (_f, _e, _l, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.write('{"type":"FeatureCollection","features":[{"id":1}],"complete":true}');
        res.end();
      });

      const res = await request(app)
        .get('/api/kepler/observations')
        .query({ filters: '{"bssid":"AA"}', enabled: '{"bssid":true}', limit: '50' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        type: 'FeatureCollection',
        features: [{ id: 1 }],
        complete: true,
      });
      expect(keplerService.streamKeplerObservations).toHaveBeenCalledWith(
        { bssid: 'AA' },
        { bssid: true },
        50,
        expect.anything(),
        expect.anything()
      );
    });

    it('returns 400 when invalid JSON is provided', async () => {
      const res = await request(app).get('/api/kepler/observations').query({ enabled: 'invalid' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /kepler/observations.arrow', () => {
    it('streams binary Arrow bytes with the Arrow IPC content type', async () => {
      const bytes = Buffer.from([0x41, 0x52, 0x52, 0x4f, 0x57]);
      keplerService.streamKeplerObservationsArrow.mockImplementationOnce(
        async (_filters, _enabled, _limit, res) => {
          res.writeHead(200, { 'Content-Type': 'application/vnd.apache.arrow.stream' });
          res.end(bytes);
        }
      );

      const res = await request(app)
        .get('/api/kepler/observations.arrow')
        .query({ filters: '{"type":"W"}', enabled: '{"type":true}' })
        .buffer(true)
        .parse((response, callback) => {
          const chunks: Buffer[] = [];
          response.on('data', (chunk: Buffer) => chunks.push(chunk));
          response.on('end', () => callback(null, Buffer.concat(chunks)));
        });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/vnd.apache.arrow.stream');
      expect(res.body).toEqual(bytes);
      expect(keplerService.streamKeplerObservationsArrow).toHaveBeenCalledWith(
        { type: 'W' },
        { type: true },
        null,
        expect.anything(),
        expect.anything()
      );
    });

    it('returns 400 for invalid filter JSON', async () => {
      const res = await request(app)
        .get('/api/kepler/observations.arrow')
        .query({ filters: 'invalid-json' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /kepler/networks', () => {
    it('returns networks successfully', async () => {
      keplerService.getKeplerNetworks.mockResolvedValueOnce({
        type: 'FeatureCollection',
        features: [],
      });

      const res = await request(app)
        .get('/api/kepler/networks')
        .query({ filters: '{"ssid":"test"}', enabled: '{"ssid":true}', limit: '5', offset: '0' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ type: 'FeatureCollection', features: [] });
      expect(keplerService.getKeplerNetworks).toHaveBeenCalledWith(
        { ssid: 'test' },
        { ssid: true },
        5,
        0
      );
    });

    it('handles service errors without status as 500', async () => {
      keplerService.getKeplerNetworks.mockRejectedValueOnce(new Error('unspecified db error'));

      const res = await request(app).get('/api/kepler/networks');
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('unspecified db error');
    });
  });
});
