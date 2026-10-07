import express from 'express';
import request from 'supertest';
import { validateFilterPayload as validateRadiusFilterPayload } from '../../server/src/services/filterQueryBuilder/validators';

const v2Service = {
  getThreatSeverityCounts: jest.fn(),
};
const logger = {
  warn: jest.fn(),
  error: jest.fn(),
};
const mockValidateFilterPayload = jest.fn((filters: unknown, enabled: unknown) =>
  validateRadiusFilterPayload(filters, enabled)
);

jest.mock('../../server/src/config/container', () => ({
  v2Service,
  filterQueryBuilder: { validateFilterPayload: mockValidateFilterPayload },
}));

jest.mock('../../server/src/logging/logger', () => logger);

const router = require('../../server/src/api/routes/v2/threats');

const app = express();
app.use('/api/v2', router);

describe('v2 threats routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockValidateFilterPayload.mockImplementation(validateRadiusFilterPayload);
  });

  it('passes parsed filters and enabled state to the service', async () => {
    const counts = { HIGH: { unique_networks: 2 } };
    v2Service.getThreatSeverityCounts.mockResolvedValueOnce(counts);

    const response = await request(app)
      .get('/api/v2/threats/severity-counts')
      .query({
        filters: JSON.stringify({ threatCategories: ['HIGH'] }),
        enabled: JSON.stringify({ threatCategories: true }),
      });

    expect(response.status).toBe(200);
    expect(v2Service.getThreatSeverityCounts).toHaveBeenCalledWith(
      { threatCategories: ['HIGH'] },
      { threatCategories: true }
    );
    expect(response.body).toEqual({ counts });
  });

  it('uses empty objects and warns for malformed JSON', async () => {
    v2Service.getThreatSeverityCounts.mockResolvedValueOnce({});

    const response = await request(app)
      .get('/api/v2/threats/severity-counts')
      .query({ filters: '{bad', enabled: '[bad' });

    expect(response.status).toBe(200);
    expect(v2Service.getThreatSeverityCounts).toHaveBeenCalledWith({}, {});
    expect(logger.warn).toHaveBeenCalledTimes(2);
  });

  it('uses empty objects when query parameters are omitted', async () => {
    v2Service.getThreatSeverityCounts.mockResolvedValueOnce({ NONE: 1 });

    const response = await request(app).get('/api/v2/threats/severity-counts');

    expect(response.status).toBe(200);
    expect(v2Service.getThreatSeverityCounts).toHaveBeenCalledWith({}, {});
  });

  it('returns 400 and skips the service for invalid radius filters', async () => {
    const response = await request(app)
      .get('/api/v2/threats/severity-counts')
      .query({
        filters: JSON.stringify({
          radiusFilter: { latitude: '43', longitude: -83, radiusMeters: 500 },
        }),
        enabled: JSON.stringify({ radiusFilter: true }),
      });

    expect(response.status).toBe(400);
    expect(response.body.errors).toEqual(
      expect.arrayContaining(['Radius filter latitude must be a finite number between -90 and 90.'])
    );
    expect(v2Service.getThreatSeverityCounts).not.toHaveBeenCalled();
  });

  it('returns the service error message and logs context', async () => {
    v2Service.getThreatSeverityCounts.mockRejectedValueOnce(new Error('count failed'));

    const response = await request(app).get('/api/v2/threats/severity-counts');

    expect(response.status).toBe(500);
    expect(response.body.error).toBe('count failed');
    expect(logger.error).toHaveBeenCalledWith(
      'Threat severity counts error: count failed',
      expect.objectContaining({ error: expect.any(Error) })
    );
  });
});
