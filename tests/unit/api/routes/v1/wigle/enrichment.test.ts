import express from 'express';
import request from 'supertest';

const mockWigleEnrichmentService = {
  forceClearEnrichmentRun: jest.fn(),
  getEnrichmentCatalog: jest.fn(),
  getPendingEnrichmentCount: jest.fn(),
  resumeEnrichment: jest.fn(),
  startBatchEnrichment: jest.fn(),
};

jest.mock('../../../../../../server/src/config/container', () => ({
  wigleEnrichmentService: mockWigleEnrichmentService,
}));

jest.mock('../../../../../../server/src/middleware/authMiddleware', () => ({
  requireAdmin: (_req: any, _res: any, next: any) => next(),
}));

import enrichmentRouter from '../../../../../../server/src/api/routes/v1/wigle/enrichment';

const app = express();
app.use(express.json());
app.use('/wigle', enrichmentRouter);

describe('wigle enrichment routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns pending enrichment stats', async () => {
    mockWigleEnrichmentService.getPendingEnrichmentCount.mockResolvedValue(12);

    const response = await request(app).get('/wigle/enrichment/stats');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true, pendingCount: 12 });
  });

  it('returns enrichment catalog with normalized pagination defaults', async () => {
    mockWigleEnrichmentService.getEnrichmentCatalog.mockResolvedValue({
      rows: [{ bssid: 'AA:BB:CC:DD:EE:FF' }],
      total: 1,
    });

    const response = await request(app)
      .get('/wigle/enrichment/catalog')
      .query({ region: 'CA', city: 'Oakland', sortBy: 'lasttime', sortDir: 'desc' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      rows: [{ bssid: 'AA:BB:CC:DD:EE:FF' }],
      total: 1,
    });
    expect(mockWigleEnrichmentService.getEnrichmentCatalog).toHaveBeenCalledWith({
      page: 1,
      limit: 50,
      region: 'CA',
      city: 'Oakland',
      ssid: undefined,
      bssid: undefined,
      sortBy: 'lasttime',
      sortDir: 'desc',
    });
  });

  it('starts batch enrichment and serializes the run', async () => {
    mockWigleEnrichmentService.startBatchEnrichment.mockResolvedValue({
      id: 7,
      source: 'wigle_v3',
      api_version: 'v3',
      search_term: 'batch',
      state: 'CA',
      request_fingerprint: 'fingerprint',
      request_params: { bssids: ['AA:BB:CC:DD:EE:FF'] },
      status: 'running',
      api_cursor: null,
      last_error: null,
      started_at: '2026-06-16T00:00:00.000Z',
      last_attempted_at: null,
      completed_at: null,
      last_successful_page: 0,
      next_page: 1,
      api_total_results: null,
      total_pages: null,
      page_size: 100,
      pages_fetched: 0,
      rows_returned: 0,
      rows_inserted: 0,
    });

    const response = await request(app)
      .post('/wigle/enrichment/start')
      .send({ bssids: ['AA:BB:CC:DD:EE:FF'] });

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.run).toMatchObject({
      id: 7,
      apiVersion: 'v3',
      requestFingerprint: 'fingerprint',
      status: 'running',
    });
    expect(mockWigleEnrichmentService.startBatchEnrichment).toHaveBeenCalledWith([
      'AA:BB:CC:DD:EE:FF',
    ]);
  });

  it('returns 400 when batch enrichment validation fails', async () => {
    const error: any = new Error('BSSID list is required');
    error.status = 400;
    mockWigleEnrichmentService.startBatchEnrichment.mockRejectedValue(error);

    const response = await request(app).post('/wigle/enrichment/start').send({});

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ ok: false, error: 'BSSID list is required' });
  });

  it('returns 403 when batch enrichment is forbidden', async () => {
    const error: any = new Error('Forbidden');
    error.status = 403;
    error.code = 'WIGLE_NOT_CONFIGURED';
    mockWigleEnrichmentService.startBatchEnrichment.mockRejectedValue(error);

    const response = await request(app)
      .post('/wigle/enrichment/start')
      .send({ bssids: ['AA:BB:CC:DD:EE:FF'] });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      ok: false,
      error: 'Forbidden',
      code: 'WIGLE_NOT_CONFIGURED',
    });
  });

  it('returns 409 when batch enrichment conflicts with an active run', async () => {
    const error: any = new Error('Run already active');
    error.status = 409;
    mockWigleEnrichmentService.startBatchEnrichment.mockRejectedValue(error);

    const response = await request(app)
      .post('/wigle/enrichment/start')
      .send({ bssids: ['AA:BB:CC:DD:EE:FF'] });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      ok: false,
      error: 'Run already active',
      code: 'ENRICHMENT_CONFLICT',
    });
  });

  it('resumes an enrichment run by id', async () => {
    mockWigleEnrichmentService.resumeEnrichment.mockResolvedValue({ id: 9, status: 'running' });

    const response = await request(app).post('/wigle/enrichment/resume/9').send({});

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true, run: { id: 9, status: 'running' } });
    expect(mockWigleEnrichmentService.resumeEnrichment).toHaveBeenCalledWith(9);
  });

  describe('resumeEnrichment error status mapping (R7)', () => {
    it('returns 400 when resumeEnrichment rejects with 400 (e.g. targeted run without target list)', async () => {
      const error: any = new Error(
        'Cannot resume targeted enrichment run #427 without a persisted target list. Please start a new run.'
      );
      error.status = 400;
      mockWigleEnrichmentService.resumeEnrichment.mockRejectedValue(error);

      const response = await request(app).post('/wigle/enrichment/resume/427').send({});

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        ok: false,
        error:
          'Cannot resume targeted enrichment run #427 without a persisted target list. Please start a new run.',
      });
    });

    it('returns 404 when resumeEnrichment rejects with 404 (run not found)', async () => {
      const error: any = new Error('Run #999 not found');
      error.status = 404;
      mockWigleEnrichmentService.resumeEnrichment.mockRejectedValue(error);

      const response = await request(app).post('/wigle/enrichment/resume/999').send({});

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        ok: false,
        error: 'Run #999 not found',
      });
    });

    it('returns 409 when resumeEnrichment conflicts with an active run', async () => {
      const error: any = new Error('Enrichment run #55 is already active');
      error.status = 409;
      error.code = 'ENRICHMENT_CONFLICT';
      mockWigleEnrichmentService.resumeEnrichment.mockRejectedValue(error);

      const response = await request(app).post('/wigle/enrichment/resume/10').send({});

      expect(response.status).toBe(409);
      expect(response.body).toEqual({
        ok: false,
        error: 'Enrichment run #55 is already active',
        code: 'ENRICHMENT_CONFLICT',
      });
    });
  });

  it('force-clears an enrichment run by id', async () => {
    mockWigleEnrichmentService.forceClearEnrichmentRun.mockResolvedValue({ cleared: true });

    const response = await request(app).post('/wigle/enrichment/force-clear/9').send({});

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true, cleared: true });
    expect(mockWigleEnrichmentService.forceClearEnrichmentRun).toHaveBeenCalledWith(9);
  });
});
