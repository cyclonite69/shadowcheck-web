import request from 'supertest';
import express from 'express';

const mockParseAndValidateFilters = jest.fn();
const mockIsParseValidatedFiltersError = jest.fn();
const mockAssertHomeExistsIfNeeded = jest.fn();

jest.mock('../../../../../server/src/api/routes/v2/filteredHelpers', () => ({
  parseAndValidateFilters: mockParseAndValidateFilters,
  isParseValidatedFiltersError: mockIsParseValidatedFiltersError,
  assertHomeExistsIfNeeded: mockAssertHomeExistsIfNeeded,
}));

const mockGetFilteredAnalytics = jest.fn();

jest.mock('../../../../../server/src/config/container', () => ({
  filterQueryBuilder: {
    validateFilterPayload: jest.fn(),
  },
  filteredAnalyticsService: {
    getFilteredAnalytics: mockGetFilteredAnalytics,
  },
}));

const analyticsPublicRouter = require('../../../../../server/src/api/routes/v1/analytics-public');

const app = express();
app.use(express.json());
app.use('/api/analytics-public', analyticsPublicRouter);

describe('Analytics Public Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/analytics-public/filtered', () => {
    it('returns validation error if parse fails', async () => {
      mockParseAndValidateFilters.mockReturnValue({ status: 400, body: { error: 'Bad filter' } });
      mockIsParseValidatedFiltersError.mockReturnValue(true);

      const response = await request(app).get('/api/analytics-public/filtered');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Bad filter' });
      expect(mockAssertHomeExistsIfNeeded).not.toHaveBeenCalled();
    });

    it('returns without doing anything if home location assertion fails', async () => {
      mockParseAndValidateFilters.mockReturnValue({ filters: {}, enabled: ['dist'] });
      mockIsParseValidatedFiltersError.mockReturnValue(false);
      // Simulate assertHomeExistsIfNeeded sending a response and returning false
      mockAssertHomeExistsIfNeeded.mockImplementation(async (enabled, res) => {
        res.status(400).json({ error: 'No home' });
        return false;
      });

      const response = await request(app).get('/api/analytics-public/filtered');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'No home' });
      expect(mockGetFilteredAnalytics).not.toHaveBeenCalled();
    });

    it('returns analytics successfully', async () => {
      mockParseAndValidateFilters.mockReturnValue({ filters: {}, enabled: [] });
      mockIsParseValidatedFiltersError.mockReturnValue(false);
      mockAssertHomeExistsIfNeeded.mockResolvedValue(true);
      mockGetFilteredAnalytics.mockResolvedValue({
        data: { activeDevices: 42 },
        queryDurationMs: 123,
      });

      const response = await request(app).get('/api/analytics-public/filtered');

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.data).toEqual({ activeDevices: 42 });
      expect(response.body.meta.queryDurationMs).toBe(123);
    });

    it('handles unexpected errors', async () => {
      mockParseAndValidateFilters.mockImplementation(() => {
        throw new Error('Something broke');
      });

      const response = await request(app).get('/api/analytics-public/filtered');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ ok: false, error: 'Something broke' });
    });

    it('handles non-Error throwables gracefully', async () => {
      mockParseAndValidateFilters.mockImplementation(() => {
        throw new Error('Unknown analytics error');
      });

      const response = await request(app).get('/api/analytics-public/filtered');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ ok: false, error: 'Unknown analytics error' });
    });
  });
});
