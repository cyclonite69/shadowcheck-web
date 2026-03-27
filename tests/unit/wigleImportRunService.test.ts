/**
 * Unit tests for resumable WiGLE import runs.
 */

export {};

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

  if (normalized === 'BEGIN' || normalized === 'COMMIT' || normalized === 'ROLLBACK') {
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

  if (normalized.includes('FROM app.wigle_import_runs WHERE request_fingerprint = $1')) {
    const statuses = Array.isArray(params[1]) ? params[1] : [];
    const matching = dbState.runs
      .filter((run) => run.request_fingerprint === params[0] && statuses.includes(run.status))
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
          pages_fetched: String(summary.pagesFetched),
          rows_returned: String(summary.rowsReturned),
          rows_inserted: String(summary.rowsInserted),
          last_successful_page: String(summary.lastSuccessfulPage),
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

  if (normalized.startsWith('UPDATE app.wigle_import_runs SET pages_fetched = $2')) {
    const run = dbState.runs.find((item) => item.id === params[0]);
    if (!run) return { rows: [], rowCount: 0 };
    run.pages_fetched = params[1];
    run.rows_returned = params[2];
    run.rows_inserted = params[3];
    run.last_successful_page = params[4];
    run.next_page =
      run.status === 'completed'
        ? Math.max(run.next_page, params[4] + 1)
        : Math.max(params[4] + 1, run.next_page);
    run.api_cursor = params[4] > 0 ? params[5] : run.api_cursor;
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

  if (normalized.startsWith('UPDATE app.wigle_import_runs SET status = $2,')) {
    const run = dbState.runs.find((item) => item.id === params[0]);
    if (!run || !['running', 'failed', 'paused'].includes(run.status)) {
      return { rows: [], rowCount: 0 };
    }
    run.status = params[1];
    run.last_attempted_at = nowIso();
    run.updated_at = nowIso();
    if (params[1] === 'cancelled') run.completed_at = nowIso();
    return { rows: [cloneRun(run)], rowCount: 1 };
  }

  if (normalized.startsWith("UPDATE app.wigle_import_runs SET status = 'running',")) {
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
    run.last_error = null;
    return { rows: [cloneRun(run)], rowCount: 1 };
  }

  if (normalized.startsWith('INSERT INTO app.wigle_import_run_pages')) {
    const isSuccess = normalized.includes('TRUE, NULL');
    const existing = dbState.pages.find(
      (page) => page.run_id === params[0] && page.page_number === params[1]
    );
    if (isSuccess) {
      const nextPage: PageRow = {
        id: existing?.id || dbState.nextPageId++,
        run_id: params[0],
        page_number: params[1],
        request_cursor: params[2],
        next_cursor: params[3],
        fetched_at: nowIso(),
        rows_returned: params[4],
        rows_inserted: params[5],
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
        run_id: params[0],
        page_number: params[1],
        request_cursor: params[2],
        next_cursor: existing?.next_cursor || null,
        fetched_at: nowIso(),
        rows_returned: existing?.rows_returned || 0,
        rows_inserted: existing?.rows_inserted || 0,
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
    normalized.startsWith(
      'UPDATE app.wigle_import_runs SET api_total_results = COALESCE($2, api_total_results)'
    )
  ) {
    const run = dbState.runs.find((item) => item.id === params[0]);
    if (!run) return { rows: [], rowCount: 0 };
    const summary = pageSummaryForRun(params[0]);
    run.api_total_results = params[1] ?? run.api_total_results;
    run.page_size = params[2];
    run.total_pages = params[3] ?? run.total_pages;
    run.last_successful_page = Math.max(run.last_successful_page, params[4]);
    run.next_page = Math.max(run.next_page, params[4] + 1);
    run.pages_fetched = summary.pagesFetched;
    run.rows_returned = summary.rowsReturned;
    run.rows_inserted = summary.rowsInserted;
    run.api_cursor = params[5];
    run.last_attempted_at = nowIso();
    run.last_error = null;
    run.updated_at = nowIso();
    return { rows: [cloneRun(run)], rowCount: 1 };
  }

  if (
    normalized.includes('FROM app.wigle_import_runs') &&
    normalized.includes('ORDER BY started_at DESC')
  ) {
    const rows = [...dbState.runs]
      .sort((a, b) => b.id - a.id)
      .slice(0, params[params.length - 1] || 20);
    return { rows: rows.map(cloneRun), rowCount: rows.length };
  }

  throw new Error(`Unhandled SQL in test double: ${normalized}`);
};

beforeEach(() => {
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

const makeResponse = (body: Record<string, unknown>) => ({
  ok: true,
  json: async () => body,
});

describe('wigleImportRunService', () => {
  it('creates a new run, persists page progress, and completes the import', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(
        makeResponse({
          totalResults: 3,
          search_after: 'cursor-2',
          results: [
            {
              netid: 'AA:AA',
              ssid: 'fbi-1',
              trilat: '1',
              trilong: '2',
              lastupdt: '2026-01-01T00:00:00Z',
            },
            {
              netid: 'BB:BB',
              ssid: 'fbi-2',
              trilat: '3',
              trilong: '4',
              lastupdt: '2026-01-02T00:00:00Z',
            },
          ],
        })
      )
      .mockResolvedValueOnce(
        makeResponse({
          totalResults: 3,
          search_after: null,
          results: [
            {
              netid: 'CC:CC',
              ssid: 'fbi-3',
              trilat: '5',
              trilong: '6',
              lastupdt: '2026-01-03T00:00:00Z',
            },
          ],
        })
      );

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const service = require('../../server/src/services/wigleImportRunService');
    const result = await service.startImportRun({
      ssid: 'fbi',
      region: 'IL',
      country: 'US',
      resultsPerPage: 2,
    });

    expect(result.status).toBe('completed');
    expect(result.state).toBe('IL');
    expect(result.searchTerm).toBe('fbi');
    expect(result.totalPages).toBe(2);
    expect(result.pagesFetched).toBe(2);
    expect(result.rowsReturned).toBe(3);
    expect(result.rowsInserted).toBe(3);
    expect(result.lastSuccessfulPage).toBe(2);
    expect(result.nextPage).toBe(3);
    expect(result.pageCompletenessPct).toBe(100);
    expect(result.rowCompletenessPct).toBe(100);
    expect(result.pages[0].pageNumber).toBe(2);
    expect(result.pages[1].pageNumber).toBe(1);
  });

  it('preserves next_page on failure and resumes exactly where it left off', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(
        makeResponse({
          totalResults: 3,
          search_after: 'cursor-2',
          results: [
            {
              netid: 'AA:AA',
              ssid: 'fbi-1',
              trilat: '1',
              trilong: '2',
              lastupdt: '2026-01-01T00:00:00Z',
            },
            {
              netid: 'BB:BB',
              ssid: 'fbi-2',
              trilat: '3',
              trilong: '4',
              lastupdt: '2026-01-02T00:00:00Z',
            },
          ],
        })
      )
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(
        makeResponse({
          totalResults: 3,
          search_after: null,
          results: [
            {
              netid: 'CC:CC',
              ssid: 'fbi-3',
              trilat: '5',
              trilong: '6',
              lastupdt: '2026-01-03T00:00:00Z',
            },
          ],
        })
      );

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const service = require('../../server/src/services/wigleImportRunService');
    const failed = await service.startImportRun({
      ssid: 'fbi',
      region: 'IL',
      country: 'US',
      resultsPerPage: 2,
    });

    expect(failed.status).toBe('failed');
    expect(failed.lastSuccessfulPage).toBe(1);
    expect(failed.nextPage).toBe(2);
    expect(failed.pagesFetched).toBe(1);
    expect(failed.rowsReturned).toBe(2);
    expect(failed.lastError).toContain('network down');

    const resumed = await service.resumeImportRun(failed.id);
    expect(resumed.status).toBe('completed');
    expect(resumed.pagesFetched).toBe(2);
    expect(resumed.rowsReturned).toBe(3);
    expect(resumed.rowsInserted).toBe(3);

    const fetchCalls = (global.fetch as jest.Mock).mock.calls.map((call) => String(call[0]));
    expect(fetchCalls[2]).toContain('searchAfter=cursor-2');
  });

  it('reconciles progress from successful page logs before resume so completed pages are not replayed', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(
        makeResponse({
          totalResults: 3,
          search_after: 'cursor-2',
          results: [
            {
              netid: 'AA:AA',
              ssid: 'fbi-1',
              trilat: '1',
              trilong: '2',
              lastupdt: '2026-01-01T00:00:00Z',
            },
            {
              netid: 'BB:BB',
              ssid: 'fbi-2',
              trilat: '3',
              trilong: '4',
              lastupdt: '2026-01-02T00:00:00Z',
            },
          ],
        })
      )
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce(
        makeResponse({
          totalResults: 3,
          search_after: null,
          results: [
            {
              netid: 'CC:CC',
              ssid: 'fbi-3',
              trilat: '5',
              trilong: '6',
              lastupdt: '2026-01-03T00:00:00Z',
            },
          ],
        })
      );

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const service = require('../../server/src/services/wigleImportRunService');
    const failed = await service.startImportRun({
      ssid: 'fbi',
      region: 'TX',
      country: 'US',
      resultsPerPage: 2,
    });

    const runRow = dbState.runs.find((run) => run.id === failed.id)!;
    runRow.next_page = 1;
    runRow.api_cursor = null;

    const resumed = await service.resumeImportRun(failed.id);
    expect(resumed.status).toBe('completed');
    expect(resumed.lastSuccessfulPage).toBe(2);
    expect(resumed.pagesFetched).toBe(2);

    const fetchCalls = (global.fetch as jest.Mock).mock.calls.map((call) => String(call[0]));
    expect(fetchCalls[2]).toContain('searchAfter=cursor-2');
    expect(resumed.rowsInserted).toBe(3);
  });

  it('supports pause and cancel control states for resumable runs', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('rate limit'));

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const service = require('../../server/src/services/wigleImportRunService');
    const failed = await service.startImportRun({
      ssid: 'fbi',
      region: 'CA',
      country: 'US',
      resultsPerPage: 2,
    });

    const paused = await service.pauseImportRun(failed.id);
    expect(paused.status).toBe('paused');

    const cancelled = await service.cancelImportRun(failed.id);
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.completedAt).toBeTruthy();
  });

  it('does not commit an extra empty terminal page when WiGLE ends with no results and no cursor', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(
        makeResponse({
          totalResults: 3,
          search_after: 'cursor-2',
          results: [
            {
              netid: 'AA:AA',
              ssid: 'fbi-1',
              trilat: '1',
              trilong: '2',
              lastupdt: '2026-01-01T00:00:00Z',
            },
            {
              netid: 'BB:BB',
              ssid: 'fbi-2',
              trilat: '3',
              trilong: '4',
              lastupdt: '2026-01-02T00:00:00Z',
            },
          ],
        })
      )
      .mockResolvedValueOnce(
        makeResponse({
          totalResults: 3,
          search_after: 'cursor-final',
          results: [
            {
              netid: 'CC:CC',
              ssid: 'fbi-3',
              trilat: '5',
              trilong: '6',
              lastupdt: '2026-01-03T00:00:00Z',
            },
          ],
        })
      )
      .mockResolvedValueOnce(
        makeResponse({
          totalResults: 3,
          search_after: null,
          results: [],
        })
      );

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const service = require('../../server/src/services/wigleImportRunService');
    const result = await service.startImportRun({
      ssid: 'fbi',
      region: 'AL',
      country: 'US',
      resultsPerPage: 2,
    });

    expect(result.status).toBe('completed');
    expect(result.totalPages).toBe(2);
    expect(result.pagesFetched).toBe(2);
    expect(result.lastSuccessfulPage).toBe(2);
    expect(result.nextPage).toBe(3);
    expect(result.rowsReturned).toBe(3);
    expect(result.rowsInserted).toBe(3);
    expect(result.pages.map((page: any) => page.pageNumber)).toEqual([2, 1]);
    expect(dbState.pages.filter((page) => page.run_id === result.id)).toHaveLength(2);
  });
});
