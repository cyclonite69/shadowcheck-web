import express from 'express';
import request from 'supertest';
import { validateFilterPayload as validateRadiusFilterPayload } from '../../server/src/services/filterQueryBuilder/validators';

const keplerService = {
  checkHomeLocationExists: jest.fn(),
};
const logger = {
  debug: jest.fn(),
  error: jest.fn(),
};
const mockValidateFilterPayload = jest.fn((filters: unknown, enabled: unknown) =>
  validateRadiusFilterPayload(filters, enabled)
);

jest.mock('../../server/src/config/container', () => ({
  keplerService,
  filterQueryBuilder: { validateFilterPayload: mockValidateFilterPayload },
}));

jest.mock('../../server/src/logging/logger', () => logger);

const { router, initDashboardRoutes } = require('../../server/src/api/routes/v1/dashboard');

const dashboardService = {
  getMetrics: jest.fn(),
  getThreats: jest.fn(),
};

const app = express();
app.use('/api', router);

describe('dashboard routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    initDashboardRoutes({ dashboardService });
    keplerService.checkHomeLocationExists.mockResolvedValue(true);
    mockValidateFilterPayload.mockImplementation(validateRadiusFilterPayload);
  });

  it('rejects requests when the dashboard service is not initialized', async () => {
    initDashboardRoutes({ dashboardService: null });

    const metrics = await request(app).get('/api/dashboard/metrics');
    const threats = await request(app).get('/api/dashboard/threats');
    const summary = await request(app).get('/api/dashboard/summary');

    expect(metrics.status).toBe(500);
    expect(threats.status).toBe(500);
    expect(summary.status).toBe(500);
  });

  it.each([
    ['filters', 'not-json', 'filters must be valid JSON'],
    ['filters', '[]', 'filters must be a JSON object'],
    ['enabled', 'null', 'enabled must be a JSON object'],
    ['enabled', 'true', 'enabled must be a JSON object'],
  ])('rejects invalid %s query input', async (field, value, error) => {
    const response = await request(app)
      .get('/api/dashboard/metrics')
      .query({ [field]: value });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe(error);
    expect(dashboardService.getMetrics).not.toHaveBeenCalled();
  });

  it('requires a configured home location for enabled distance filters', async () => {
    keplerService.checkHomeLocationExists.mockResolvedValueOnce(false);

    const response = await request(app)
      .get('/api/dashboard/metrics')
      .query({ enabled: JSON.stringify({ distanceFromHomeMin: true }) });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Home location is required');
    expect(dashboardService.getMetrics).not.toHaveBeenCalled();
  });

  it('returns 400 and skips the service for invalid radius filters', async () => {
    const response = await request(app)
      .get('/api/dashboard/metrics')
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
    expect(dashboardService.getMetrics).not.toHaveBeenCalled();
  });

  it('returns home-location lookup errors as validation failures', async () => {
    keplerService.checkHomeLocationExists.mockRejectedValueOnce(new Error('home lookup failed'));

    const response = await request(app)
      .get('/api/dashboard/metrics')
      .query({ enabled: JSON.stringify({ distanceFromHomeMax: true }) });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('home lookup failed');
  });

  it('returns normalized metrics and passes parsed filters', async () => {
    dashboardService.getMetrics.mockResolvedValueOnce({
      threatsCritical: 2,
      totalNetworks: 8,
      wifiCount: 5,
      totalObservations: 20,
      nrObservations: 3,
      activeSurveillance: 1,
      enrichedCount: 4,
      filtersApplied: 2,
      lastUpdated: '2026-06-13T00:00:00Z',
    });

    const filters = { ssid: 'target' };
    const enabled = { ssid: true };
    const response = await request(app)
      .get('/api/dashboard/metrics')
      .query({ filters: JSON.stringify(filters), enabled: JSON.stringify(enabled) });

    expect(response.status).toBe(200);
    expect(dashboardService.getMetrics).toHaveBeenCalledWith(filters, enabled);
    expect(response.body.networks).toEqual({
      total: 8,
      wifi: 5,
      ble: 0,
      bluetooth: 0,
      lte: 0,
      nr: 0,
      gsm: 0,
    });
    expect(response.body.observations.nr).toBe(3);
    expect(response.body.threats.critical).toBe(2);
  });

  it('returns dashboard metric service errors', async () => {
    dashboardService.getMetrics.mockRejectedValueOnce(new Error('metrics failed'));

    const response = await request(app).get('/api/dashboard/metrics');

    expect(response.status).toBe(500);
    expect(response.body.error).toBe('metrics failed');
  });

  it('returns threats and summary data', async () => {
    dashboardService.getThreats.mockResolvedValueOnce([{ id: 1 }]);
    dashboardService.getMetrics.mockResolvedValueOnce({
      totalNetworks: 10,
      threatsCritical: 1,
      threatsHigh: 2,
      threatsMedium: 3,
      threatsLow: 4,
      activeSurveillance: 5,
      lastUpdated: 'now',
    });

    const threats = await request(app).get('/api/dashboard/threats');
    const summary = await request(app).get('/api/dashboard/summary');

    expect(threats.status).toBe(200);
    expect(threats.body.total).toBe(1);
    expect(summary.status).toBe(200);
    expect(summary.body.summary).toEqual({
      totalNetworks: 10,
      totalThreats: 10,
      criticalThreats: 1,
      activeSurveillance: 5,
    });
  });

  it('returns errors from threats and summary services', async () => {
    dashboardService.getThreats.mockRejectedValueOnce(new Error('threats failed'));
    dashboardService.getMetrics.mockRejectedValueOnce(new Error('summary failed'));

    const threats = await request(app).get('/api/dashboard/threats');
    const summary = await request(app).get('/api/dashboard/summary');

    expect(threats.status).toBe(500);
    expect(threats.body.error).toBe('threats failed');
    expect(summary.status).toBe(500);
    expect(summary.body.error).toBe('summary failed');
  });
});
