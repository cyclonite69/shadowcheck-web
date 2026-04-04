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
        missing_api_rows: 693,
        missing_insert_rows: 1488,
      },
    ]);

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const service = require('../../server/src/services/wigleImportRunService');
    const report = await service.getImportCompletenessReport({ searchTerm: 'fbi' });

    expect(mockGetImportCompletenessSummary).toHaveBeenCalledWith({ searchTerm: 'fbi' });
    expect(report.states).toHaveLength(1);
    expect(report.states[0]).toEqual(
      expect.objectContaining({
        state: 'PA',
        storedCount: 1795,
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
});
