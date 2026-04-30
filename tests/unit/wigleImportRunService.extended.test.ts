/**
 * Extended Unit tests for resumable WiGLE import runs.
 */

import {
  getRequestFingerprint,
  normalizeImportParams,
} from '../../server/src/services/wigleImport/params';

export {};

jest.mock('../../server/src/services/wigleImport/rateLimitingStrategy', () => ({
  getAdaptiveDelay: () => 0,
  sleep: async () => {},
}));

type RunRow = {
  id: number;
  source: string;
  api_version: string;
  search_term: string;
  state: string | null;
  request_fingerprint: string;
  request_params: Record<string, unknown>;
  status: string;
  api_total_results: number | null;
  page_size: number;
  total_pages: number | null;
  last_successful_page: number;
  next_page: number;
  pages_fetched: number;
  rows_returned: number;
  rows_inserted: number;
  api_cursor: string | null;
  last_error: string | null;
  started_at: string;
  last_attempted_at: string | null;
  completed_at: string | null;
  updated_at: string;
};

type PageRow = {
  id: number;
  run_id: number;
  page_number: number;
  request_cursor: string | null;
  next_cursor: string | null;
  fetched_at: string;
  rows_returned: number;
  rows_inserted: number;
  success: boolean;
  error_message: string | null;
  updated_at: string;
};

const dbState: {
  runs: RunRow[];
  pages: PageRow[];
  nextRunId: number;
  nextPageId: number;
  insertedKeys: Set<string>;
} = {
  runs: [],
  pages: [],
  nextRunId: 1,
  nextPageId: 1,
  insertedKeys: new Set<string>(),
};

const mockQuery = jest.fn();
const mockPoolConnect = jest.fn();
const mockSecretGet = jest.fn();
const mockImportWigleV2SearchResult = jest.fn();

jest.mock('../../server/src/config/database', () => ({
  query: (...args: any[]) => mockQuery(...args),
  pool: {
    connect: (...args: any[]) => mockPoolConnect(...args),
  },
}));

jest.mock('../../server/src/services/secretsManager', () => ({
  __esModule: true,
  default: {
    get: (...args: any[]) => mockSecretGet(...args),
  },
}));

jest.mock('../../server/src/services/wigleService', () => ({
  importWigleV2SearchResult: (...args: any[]) => mockImportWigleV2SearchResult(...args),
}));

const nowIso = () => new Date('2026-03-27T12:00:00.000Z').toISOString();

const cloneRun = (row: RunRow) => ({ ...row, request_params: { ...row.request_params } });
const clonePage = (row: PageRow) => ({ ...row });

const pageSummaryForRun = (runId: number) => {
  const successPages = dbState.pages.filter((page) => page.run_id === runId && page.success);
  return {
    pagesFetched: successPages.length,
    rowsReturned: successPages.reduce((sum, page) => sum + page.rows_returned, 0),
    rowsInserted: successPages.reduce((sum, page) => sum + page.rows_inserted, 0),
    lastSuccessfulPage: successPages.reduce((max, page) => Math.max(max, page.page_number), 0),
  };
};

const executeSql = async (sql: string, params: any[] = []) => {
  const normalized = sql.replace(/\s+/g, ' ').trim();

  if (
    normalized === 'BEGIN' ||
    normalized === 'COMMIT' ||
    normalized === 'ROLLBACK' ||
    normalized.startsWith('SAVEPOINT') ||
    normalized.startsWith('RELEASE SAVEPOINT') ||
    normalized.startsWith('ROLLBACK TO SAVEPOINT')
  ) {
    return { rows: [], rowCount: 0 };
  }

  if (normalized.startsWith('INSERT INTO app.wigle_import_runs')) {
    const run: RunRow = {
      id: dbState.nextRunId++,
      source: 'wigle',
      api_version: params[0],
      search_term: params[1],
      state: params[2],
      request_fingerprint: params[3],
      request_params: JSON.parse(params[4]),
      status: 'running',
      api_total_results: null,
      page_size: params[5],
      total_pages: null,
      last_successful_page: 0,
      next_page: 1,
      pages_fetched: 0,
      rows_returned: 0,
      rows_inserted: 0,
      api_cursor: null,
      last_error: null,
      started_at: nowIso(),
      last_attempted_at: null,
      completed_at: null,
      updated_at: nowIso(),
    };
    dbState.runs.push(run);
    return { rows: [cloneRun(run)], rowCount: 1 };
  }

  if (normalized.startsWith('SELECT * FROM app.wigle_import_runs WHERE id = $1')) {
    const run = dbState.runs.find((item) => item.id === params[0]);
    return { rows: run ? [cloneRun(run)] : [], rowCount: run ? 1 : 0 };
  }

  if (
    normalized.includes(
      'FROM app.wigle_import_runs WHERE request_fingerprint = $1 AND status = ANY($2::text[])'
    )
  ) {
    const fingerprint = params[0];
    const statuses = params[1];
    const matching = dbState.runs
      .filter((run) => run.request_fingerprint === fingerprint && statuses.includes(run.status))
      .sort((a, b) => b.id - a.id);
    return {
      rows: matching.length > 0 ? [cloneRun(matching[0])] : [],
      rowCount: matching.length > 0 ? 1 : 0,
    };
  }

  if (normalized.startsWith('SELECT * FROM app.wigle_import_run_pages WHERE run_id = $1')) {
    const pages = dbState.pages
      .filter((page) => page.run_id === params[0])
      .sort((a, b) => b.page_number - a.page_number)
      .slice(0, params[1] || 50)
      .map(clonePage);
    return { rows: pages, rowCount: pages.length };
  }

  if (normalized.includes('COUNT(*) FILTER (WHERE success) AS pages_fetched')) {
    const summary = pageSummaryForRun(params[0]);
    return {
      rows: [
        {
          pages_fetched: summary.pagesFetched,
          rows_returned: summary.rowsReturned,
          rows_inserted: summary.rowsInserted,
          last_successful_page: summary.lastSuccessfulPage,
        },
      ],
      rowCount: 1,
    };
  }

  if (normalized.startsWith('SELECT next_cursor FROM app.wigle_import_run_pages')) {
    const page = dbState.pages.find(
      (item) => item.run_id === params[0] && item.success && item.page_number === params[1]
    );
    return { rows: page ? [{ next_cursor: page.next_cursor }] : [], rowCount: page ? 1 : 0 };
  }

  if (
    normalized.startsWith('UPDATE app.wigle_import_runs SET pages_fetched = $2') ||
    normalized.startsWith(
      'UPDATE app.wigle_import_runs SET api_total_results = COALESCE($2, api_total_results)'
    )
  ) {
    const run = dbState.runs.find((item) => item.id === params[0]);
    if (!run) return { rows: [], rowCount: 0 };

    if (normalized.includes('api_total_results = COALESCE($2, api_total_results)')) {
      run.api_total_results = params[1] ?? run.api_total_results;
      run.page_size = params[2];
      run.total_pages = params[3] ?? run.total_pages;
      run.last_successful_page = Math.max(run.last_successful_page, params[4]);
      run.api_cursor = params[5];
      if (params[6] === true) {
        run.status = 'completed';
        run.completed_at = nowIso();
      }
    } else {
      const shouldComplete =
        run.status !== 'cancelled' &&
        params[1] > 0 &&
        params[5] === null &&
        (run.total_pages === null || params[1] >= run.total_pages);
      run.pages_fetched = params[1];
      run.rows_returned = params[2];
      run.rows_inserted = params[3];
      run.last_successful_page = params[4];
      run.api_cursor = params[5] || run.api_cursor;
      if (shouldComplete) {
        run.status = 'completed';
        run.completed_at = run.completed_at || nowIso();
        run.last_error = null;
      }
    }
    run.next_page = run.last_successful_page + 1;
    const summary = pageSummaryForRun(run.id);
    run.pages_fetched = summary.pagesFetched;
    run.rows_returned = summary.rowsReturned;
    run.rows_inserted = summary.rowsInserted;
    run.updated_at = nowIso();
    return { rows: [cloneRun(run)], rowCount: 1 };
  }

  if (normalized.startsWith("UPDATE app.wigle_import_runs SET status = 'failed'")) {
    const run = dbState.runs.find((item) => item.id === params[0]);
    if (!run) return { rows: [], rowCount: 0 };
    run.status = 'failed';
    run.last_error = params[1];
    run.last_attempted_at = nowIso();
    run.updated_at = nowIso();
    return { rows: [cloneRun(run)], rowCount: 1 };
  }

  if (
    normalized.startsWith('UPDATE app.wigle_import_runs SET status = $2,') &&
    normalized.includes("IN ('running', 'failed', 'paused')")
  ) {
    const runId = params[0];
    const status = params[1];
    const run = dbState.runs.find((item) => item.id === runId);
    if (!run || !['running', 'failed', 'paused'].includes(run.status)) {
      return { rows: [], rowCount: 0 };
    }
    run.status = status;
    run.last_attempted_at = nowIso();
    run.updated_at = nowIso();
    if (status === 'cancelled') run.completed_at = nowIso();
    return { rows: [cloneRun(run)], rowCount: 1 };
  }

  if (
    normalized.startsWith("UPDATE app.wigle_import_runs SET status = 'running',") &&
    normalized.includes("IN ('running', 'paused', 'failed')")
  ) {
    const run = dbState.runs.find((item) => item.id === params[0]);
    if (!run || !['running', 'paused', 'failed'].includes(run.status)) {
      return { rows: [], rowCount: 0 };
    }
    run.status = 'running';
    run.last_error = null;
    run.updated_at = nowIso();
    return { rows: [cloneRun(run)], rowCount: 1 };
  }

  if (normalized.startsWith("UPDATE app.wigle_import_runs SET status = 'completed'")) {
    const run = dbState.runs.find((item) => item.id === params[0]);
    if (!run) return { rows: [], rowCount: 0 };
    run.status = 'completed';
    run.completed_at = nowIso();
    run.updated_at = nowIso();
    run.last_error = params[1] || null;
    return { rows: [cloneRun(run)], rowCount: 1 };
  }

  if (normalized.startsWith('INSERT INTO app.wigle_import_run_pages')) {
    const isSuccess = normalized.includes('FALSE') === false;
    const runId = params[0];
    const pageNumber = params[1];
    const requestCursor = params[2];
    const existing = dbState.pages.find(
      (page) => page.run_id === runId && page.page_number === pageNumber
    );
    if (isSuccess) {
      const nextPage: PageRow = {
        id: existing?.id || dbState.nextPageId++,
        run_id: runId,
        page_number: pageNumber,
        request_cursor: requestCursor,
        next_cursor: params[3],
        fetched_at: nowIso(),
        rows_returned: params[4] || 0,
        rows_inserted: params[5] || 0,
        success: true,
        error_message: null,
        updated_at: nowIso(),
      };
      if (existing) {
        Object.assign(existing, nextPage);
      } else {
        dbState.pages.push(nextPage);
      }
    } else {
      const nextPage: PageRow = {
        id: existing?.id || dbState.nextPageId++,
        run_id: runId,
        page_number: pageNumber,
        request_cursor: requestCursor,
        next_cursor: existing?.next_cursor || null,
        fetched_at: nowIso(),
        rows_returned: 0,
        rows_inserted: 0,
        success: false,
        error_message: params[3],
        updated_at: nowIso(),
      };
      if (existing) {
        Object.assign(existing, nextPage);
      } else {
        dbState.pages.push(nextPage);
      }
    }
    return { rows: [], rowCount: 1 };
  }

  if (
    normalized.includes(
      "COUNT(*)::int AS count FROM app.wigle_import_runs WHERE request_fingerprint = $1 AND status = 'cancelled'"
    )
  ) {
    const fingerprint = params[0];
    const count = dbState.runs.filter(
      (r) => r.request_fingerprint === fingerprint && r.status === 'cancelled'
    ).length;
    return { rows: [{ count }], rowCount: 1 };
  }

  if (
    normalized.includes(
      "SELECT id FROM app.wigle_import_runs WHERE status = 'cancelled' AND state IS NULL"
    )
  ) {
    const ids = dbState.runs
      .filter((r) => r.status === 'cancelled' && r.state === null)
      .map((r) => r.id);
    return { rows: ids.map((id) => ({ id })), rowCount: ids.length };
  }

  if (
    normalized.startsWith(
      "DELETE FROM app.wigle_import_runs WHERE id = ANY($1::bigint[]) AND status = 'cancelled'"
    )
  ) {
    const ids = params[0];
    const initialCount = dbState.runs.length;
    dbState.runs = dbState.runs.filter(
      (r) => !(ids.includes(Number(r.id)) && r.status === 'cancelled')
    );
    return { rows: [], rowCount: initialCount - dbState.runs.length };
  }

  if (normalized.includes('WITH latest_runs AS')) {
    return {
      rows: dbState.runs.map((run) => ({
        state: run.state || 'UNKNOWN',
        stored_count: 0,
        run_id: run.id,
        search_term: run.search_term,
        request_params: run.request_params,
        request_fingerprint: run.request_fingerprint,
        status: run.status,
        api_total_results: run.api_total_results,
        total_pages: run.total_pages,
        page_size: run.page_size,
        pages_fetched: run.pages_fetched,
        rows_returned: run.rows_returned,
        rows_inserted: run.rows_inserted,
        last_successful_page: run.last_successful_page,
        next_page: run.next_page,
        api_cursor: run.api_cursor,
        last_error: run.last_error,
        started_at: run.started_at,
        updated_at: run.updated_at,
        completed_at: run.completed_at,
        missing_api_rows: 0,
        missing_insert_rows: 0,
      })),
      rowCount: dbState.runs.length,
    };
  }

  throw new Error(`Unhandled SQL in test double: ${normalized}`);
};

beforeEach(() => {
  jest.resetModules();
  dbState.runs = [];
  dbState.pages = [];
  dbState.nextRunId = 1;
  dbState.nextPageId = 1;
  dbState.insertedKeys = new Set<string>();
  mockQuery.mockReset();
  mockPoolConnect.mockReset();
  mockSecretGet.mockReset();
  mockImportWigleV2SearchResult.mockReset();
  global.fetch = jest.fn() as any;

  mockQuery.mockImplementation((sql: string, params?: any[]) => executeSql(sql, params));
  mockPoolConnect.mockResolvedValue({
    query: (sql: string, params?: any[]) => executeSql(sql, params),
    release: jest.fn(),
  });
  mockSecretGet.mockImplementation((key: string) => {
    if (key === 'wigle_api_name') return 'user';
    if (key === 'wigle_api_token') return 'token';
    return null;
  });
  mockImportWigleV2SearchResult.mockImplementation(async (network: any) => {
    const uniqueKey = `${network.netid || network.bssid}|${network.trilat}|${network.trilong}|${network.lastupdt}`;
    if (dbState.insertedKeys.has(uniqueKey)) return 0;
    dbState.insertedKeys.add(uniqueKey);
    return 1;
  });
});

const makeResponse = (body: any, ok = true, status = 200, headers?: Record<string, string>) => {
  const headerBag = new Headers(headers || {});
  const response: any = {
    ok,
    status,
    headers: headerBag,
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  };
  response.clone = () => response;
  return response;
};

describe('wigleImportRunService - Extended', () => {
  const getService = () => require('../../server/src/services/wigleImportRunService');

  describe('Secrets & Auth', () => {
    it('throws error if WiGLE API credentials are missing', async () => {
      mockSecretGet.mockReturnValue(null);
      const service = getService();
      await expect(service.startImportRun({ ssid: 'test', country: 'US' })).rejects.toThrow(
        'WiGLE API credentials not configured'
      );
    });
  });

  describe('Validation & Guards', () => {
    it('throws validation error for invalid query', async () => {
      // Mock validateImportQuery since the real one is hard to fail
      const params = require('../../server/src/services/wigleImport/params');
      const original = params.validateImportQuery;
      params.validateImportQuery = jest.fn().mockReturnValue('mock error');

      const service = getService();
      await expect(service.startImportRun({})).rejects.toThrow('mock error');

      params.validateImportQuery = original;
    });

    it('triggers cluster guard if 3 identical cancelled runs exist', async () => {
      const normalized = normalizeImportParams({ ssid: 'guard-test', country: 'US' });
      const fingerprint = getRequestFingerprint(normalized);

      for (let i = 0; i < 3; i++) {
        dbState.runs.push({
          id: dbState.nextRunId++,
          request_fingerprint: fingerprint,
          status: 'cancelled',
          request_params: normalized,
          started_at: nowIso(),
        } as any);
      }

      const service = getService();
      await expect(service.startImportRun({ ssid: 'guard-test', country: 'US' })).rejects.toThrow(
        /Cluster guard: 3 identical cancelled runs created/
      );
    });
  });

  describe('Run Resumption Logic', () => {
    it('resumes an existing run instead of creating a duplicate in startImportRun', async () => {
      const normalized = normalizeImportParams({ ssid: 'res-test', country: 'US' });
      const fingerprint = getRequestFingerprint(normalized);

      dbState.runs.push({
        id: 10,
        request_fingerprint: fingerprint,
        status: 'paused',
        request_params: normalized,
        next_page: 1,
        api_cursor: null,
      } as any);

      (global.fetch as jest.Mock).mockResolvedValue(makeResponse({ results: [] }));

      const service = getService();
      const result = await service.startImportRun({ ssid: 'res-test', country: 'US' });
      expect(result.id).toBe(10);
      // startImportRun does not auto-resume paused runs; resumeImportRun must be used explicitly.
      expect(result.status).toBe('paused');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('returns completed run immediately in resumeImportRun', async () => {
      dbState.runs.push({
        id: 20,
        status: 'completed',
        request_params: { ssid: 'test', country: 'US' },
      } as any);

      const service = getService();
      const result = await service.resumeImportRun(20);
      expect(result.id).toBe(20);
      expect(result.status).toBe('completed');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('reconciles a stale final-page run to completed before any resume fetch occurs', async () => {
      dbState.runs.push({
        id: 25,
        source: 'wigle',
        api_version: 'v2',
        search_term: 'stale-final',
        state: 'IL',
        request_fingerprint: 'fp-stale-final',
        request_params: { ssid: 'stale-final', region: 'IL', country: 'US' },
        status: 'running',
        api_total_results: 2,
        page_size: 1,
        total_pages: 2,
        last_successful_page: 1,
        next_page: 3,
        pages_fetched: 1,
        rows_returned: 1,
        rows_inserted: 1,
        api_cursor: null,
        last_error: null,
        started_at: nowIso(),
        last_attempted_at: null,
        completed_at: null,
        updated_at: nowIso(),
      } as any);

      dbState.pages.push(
        {
          id: dbState.nextPageId++,
          run_id: 25,
          page_number: 1,
          request_cursor: null,
          next_cursor: 'cursor-2',
          fetched_at: nowIso(),
          rows_returned: 1,
          rows_inserted: 1,
          success: true,
          error_message: null,
          updated_at: nowIso(),
        },
        {
          id: dbState.nextPageId++,
          run_id: 25,
          page_number: 2,
          request_cursor: 'cursor-2',
          next_cursor: null,
          fetched_at: nowIso(),
          rows_returned: 1,
          rows_inserted: 1,
          success: true,
          error_message: null,
          updated_at: nowIso(),
        }
      );

      const service = getService();
      const result = await service.resumeImportRun(25);

      expect(result.status).toBe('completed');
      expect(result.pagesFetched).toBe(2);
      expect(result.rowsReturned).toBe(2);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('throws error when resuming a cancelled run', async () => {
      dbState.runs.push({
        id: 30,
        status: 'cancelled',
        request_params: { ssid: 'test', country: 'US' },
      } as any);

      const service = getService();
      await expect(service.resumeImportRun(30)).rejects.toThrow(
        'Cannot resume a cancelled WiGLE import run'
      );
    });
  });

  describe('Error Handling & Edge Cases', () => {
    it('marks run as failed on malformed API response', async () => {
      (global.fetch as jest.Mock).mockResolvedValue(makeResponse(null as any));
      const service = getService();
      const result = await service.startImportRun({ ssid: 'test', country: 'US' });
      expect(result.status).toBe('failed');
      expect(result.lastError).toBe('WiGLE API returned a malformed response');
    });

    it('pauses run on 429 Too Many Requests', async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        makeResponse({ message: 'too many requests' }, false, 429)
      );

      const service = getService();
      const result = await service.startImportRun({ ssid: 'test', country: 'US' });
      expect(result.status).toBe('paused');
    });

    it('fails run when page number exceeds expected page count', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(
          makeResponse({
            totalResults: 1,
            results: [{ netid: '1' }],
            search_after: 'cursor',
          })
        )
        .mockResolvedValueOnce(
          makeResponse({
            totalResults: 1,
            results: [{ netid: '2' }],
            search_after: 'cursor2',
          })
        );

      const service = getService();
      const result = await service.startImportRun({
        ssid: 'test',
        country: 'US',
        resultsPerPage: 1,
      });
      expect(result.status).toBe('failed');
      expect(result.lastError).toContain('exceeded expected page count');
    });

    it('fails run on empty results with next cursor', async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        makeResponse({
          totalResults: 10,
          results: [],
          search_after: 'cursor',
        })
      );

      const service = getService();
      const result = await service.startImportRun({ ssid: 'test', country: 'US' });
      expect(result.status).toBe('failed');
      expect(result.lastError).toContain('empty page 1 returned with a next cursor');
    });
  });

  describe('Control Functions', () => {
    it('throws error when pausing non-existent run', async () => {
      const service = getService();
      await expect(service.pauseImportRun(999)).rejects.toThrow(
        'WiGLE import run 999 not found or not pausable'
      );
    });

    it('throws error when cancelling non-existent run', async () => {
      const service = getService();
      await expect(service.cancelImportRun(999)).rejects.toThrow(
        'WiGLE import run 999 not found or not cancellable'
      );
    });
  });

  describe('Reporting & Bulk Operations', () => {
    it('generates completeness report', async () => {
      dbState.runs.push({
        id: 1,
        status: 'running',
        request_params: { ssid: 'test', country: 'US' },
        started_at: nowIso(),
        updated_at: nowIso(),
      } as any);

      const service = getService();
      const report = await service.getImportCompletenessReport({});
      expect(report.generatedAt).toBeDefined();
      expect(report.states).toHaveLength(1);
      expect(report.states[0].runId).toBe(1);
    });

    it('handles bulk delete of cancelled cluster', async () => {
      dbState.runs.push({ id: 100, status: 'cancelled', state: null } as any);
      dbState.runs.push({ id: 101, status: 'cancelled', state: null } as any);
      dbState.runs.push({ id: 102, status: 'running', state: null } as any);

      const service = getService();
      const deletedCount = await service.bulkDeleteGlobalCancelledCluster();
      expect(deletedCount).toBe(2);
      expect(dbState.runs.find((r) => r.id === 100)).toBeUndefined();
      expect(dbState.runs.find((r) => r.id === 102)).toBeDefined();
    });
  });

  describe('Other resume functions', () => {
    it('resumeLatestImportRun starts new run if none exists', async () => {
      (global.fetch as jest.Mock).mockResolvedValue(makeResponse({ results: [] }));
      const service = getService();
      const result = await service.resumeLatestImportRun({ ssid: 'test', country: 'US' });
      expect(result.id).toBe(1);
    });

    it('resumeLatestImportRun resumes if one exists', async () => {
      const normalized = normalizeImportParams({ ssid: 'test', country: 'US' });
      const fingerprint = getRequestFingerprint(normalized);
      dbState.runs.push({
        id: 5,
        status: 'paused',
        request_fingerprint: fingerprint,
        request_params: normalized,
      } as any);
      (global.fetch as jest.Mock).mockResolvedValue(makeResponse({ results: [] }));
      const service = getService();
      const result = await service.resumeLatestImportRun({ ssid: 'test', country: 'US' });
      expect(result.id).toBe(5);
    });

    it('getLatestResumableImportRun returns latest resumable run', async () => {
      const normalized = normalizeImportParams({ ssid: 'test', country: 'US' });
      const fingerprint = getRequestFingerprint(normalized);
      dbState.runs.push({
        id: 5,
        status: 'paused',
        request_fingerprint: fingerprint,
        request_params: normalized,
      } as any);
      const service = getService();
      const result = await service.getLatestResumableImportRun({ ssid: 'test', country: 'US' });
      expect(result.id).toBe(5);
    });
  });
});
