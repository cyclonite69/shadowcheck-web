export {};

const mockGetImportCompletenessSummary = jest.fn();

jest.mock('../../server/src/services/wigleImport/runRepository', () => ({
  getImportCompletenessSummary: (...args: any[]) => mockGetImportCompletenessSummary(...args),
  completeRun: jest.fn(),
  createImportRun: jest.fn(),
  findLatestResumableRun: jest.fn(),
  getImportRun: jest.fn(),
  getLatestResumableImportRun: jest.fn(),
  getRunOrThrow: jest.fn(),
  listImportRuns: jest.fn(),
  markRunControlStatus: jest.fn(),
  markRunFailure: jest.fn(),
  persistPageFailure: jest.fn(),
  reconcileRunProgress: jest.fn(),
  resumeRunState: jest.fn(),
}));

jest.mock('../../server/src/services/secretsManager', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    getOrThrow: jest.fn(),
  },
}));

jest.mock('../../server/src/config/database', () => ({
  query: jest.fn(),
  pool: {
    connect: jest.fn(),
  },
}));

jest.mock('../../server/src/services/wigleImport/pageProcessor', () => ({
  processSuccessfulPage: jest.fn(),
}));

describe('wigleImportRunService completeness report', () => {
  beforeEach(() => {
    mockGetImportCompletenessSummary.mockReset();
  });

  it('maps DB summary rows into an admin-facing completeness report', async () => {
    mockGetImportCompletenessSummary.mockResolvedValue([
      {
        state: 'PA',
        local_rows: 1810,
        local_unique_bssids: 1795,
        stored_count: 1795,
        run_id: 19,
        search_term: 'fbi',
        status: 'failed',
        api_total_results: 2393,
        total_pages: 24,
        page_size: 100,
        pages_fetched: 17,
        rows_returned: 1700,
        rows_inserted: 905,
        last_successful_page: 17,
        next_page: 18,
        api_cursor: 'cursor-18',
        last_error: 'too many queries today',
        started_at: '2026-04-03T12:00:00.000Z',
        updated_at: '2026-04-03T12:05:00.000Z',
        completed_at: null,
        ledger_status: 'success',
        ledger_requested_at: '2026-04-03T12:04:00.000Z',
        ledger_http_status: 200,
        ledger_result_count: 100,
        ledger_retry_after_hint: null,
        ledger_error: null,
        missing_api_rows: 693,
        missing_insert_rows: 1488,
      },
    ]);

    const service = require('../../server/src/services/wigleImportRunService');
    const report = await service.getImportCompletenessReport({ searchTerm: 'fbi' });

    expect(mockGetImportCompletenessSummary).toHaveBeenCalledWith({ searchTerm: 'fbi' });
    expect(report.states).toHaveLength(1);
    expect(report.states[0]).toEqual(
      expect.objectContaining({
        state: 'PA',
        localRows: 1810,
        localUniqueBssids: 1795,
        storedCount: 1795,
        knownRemoteAvailable: 2393,
        gap: 598,
        lastLedgerProbeAt: '2026-04-03T12:04:00.000Z',
        lastLedgerHttpStatus: 200,
        lastLedgerResultCount: 100,
        ledgerStatus: 'known',
        runId: 19,
        status: 'failed',
        apiTotalResults: 2393,
        rowsReturned: 1700,
        rowsInserted: 905,
        missingApiRows: 693,
        missingInsertRows: 1488,
        resumable: true,
      })
    );
  });

  it('returns local counts when no matching import run exists', async () => {
    mockGetImportCompletenessSummary.mockResolvedValue([
      {
        state: 'CA',
        local_rows: 2104,
        local_unique_bssids: 2104,
        run_id: null,
        status: null,
        rows_inserted: null,
        ledger_status: 'success',
        ledger_requested_at: '2026-06-19T02:36:07.000Z',
        ledger_http_status: 200,
        ledger_result_count: 100,
      },
    ]);

    const service = require('../../server/src/services/wigleImportRunService');
    const report = await service.getImportCompletenessReport({
      searchTerm: 'fbi surveillance van',
    });

    expect(report.states[0]).toEqual(
      expect.objectContaining({
        state: 'CA',
        localRows: 2104,
        localUniqueBssids: 2104,
        knownRemoteAvailable: null,
        gap: null,
        lastLedgerResultCount: 100,
        ledgerStatus: 'unknown',
        runId: null,
        rowsInserted: null,
      })
    );
  });

  it('surfaces rate-limit and error ledger outcomes without making a WiGLE request', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    mockGetImportCompletenessSummary.mockResolvedValue([
      {
        state: 'CA',
        local_rows: 10,
        local_unique_bssids: 9,
        api_total_results: 20,
        ledger_status: 'rate_limited',
        ledger_requested_at: '2026-06-19T12:00:00.000Z',
        ledger_http_status: 429,
        ledger_retry_after_hint: 60,
        ledger_error: 'HTTP 429',
      },
      {
        state: 'TX',
        local_rows: 5,
        local_unique_bssids: 5,
        api_total_results: null,
        ledger_status: 'error',
        ledger_requested_at: '2026-06-19T13:00:00.000Z',
        ledger_http_status: 500,
        ledger_error: 'HTTP 500',
      },
    ]);

    const service = require('../../server/src/services/wigleImportRunService');
    const report = await service.getImportCompletenessReport({ searchTerm: 'fbi' });

    expect(report.states[0]).toEqual(
      expect.objectContaining({
        knownRemoteAvailable: 20,
        gap: 11,
        ledgerStatus: 'rate_limited',
        lastLedgerHttpStatus: 429,
        lastLedgerRetryAfterHint: 60,
        lastLedgerError: 'HTTP 429',
      })
    );
    expect(report.states[1]).toEqual(
      expect.objectContaining({
        knownRemoteAvailable: null,
        gap: null,
        ledgerStatus: 'error',
        lastLedgerHttpStatus: 500,
        lastLedgerError: 'HTTP 500',
      })
    );
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
