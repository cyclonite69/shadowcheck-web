import express from 'express';
import request from 'supertest';

const mockStreamKeplerObservationsArrow = jest.fn();

jest.mock('../../../../../server/src/config/container', () => ({
  keplerService: {
    streamKeplerObservationsArrow: mockStreamKeplerObservationsArrow,
  },
}));

jest.mock('../../../../../server/src/logging/logger', () => ({
  error: jest.fn(),
}));

const keplerRouter = require('../../../../../server/src/api/routes/v1/kepler');
const app = express();
app.use('/api', keplerRouter);

describe('GET /api/kepler/observations.arrow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns a binary Arrow stream and delegates decoded filters', async () => {
    const arrowBytes = Buffer.from([0x41, 0x52, 0x52, 0x4f, 0x57]);
    mockStreamKeplerObservationsArrow.mockImplementationOnce(
      async (_filters, _enabled, _limit, res) => {
        res.writeHead(200, {
          'Content-Type': 'application/vnd.apache.arrow.stream',
          'Transfer-Encoding': 'chunked',
        });
        res.end(arrowBytes);
      }
    );

    const response = await request(app)
      .get('/api/kepler/observations.arrow')
      .query({ filters: '{"bssid":"00:11"}', enabled: '{"bssid":true}' })
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      });

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('application/vnd.apache.arrow.stream');
    expect(response.body).toEqual(arrowBytes);
    expect(mockStreamKeplerObservationsArrow).toHaveBeenCalledWith(
      { bssid: '00:11' },
      { bssid: true },
      null,
      expect.anything(),
      expect.anything()
    );
  });
});
