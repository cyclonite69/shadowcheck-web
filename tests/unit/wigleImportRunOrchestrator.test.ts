export {};

const mockReconcileRunProgress = jest.fn();
const mockGetRunOrThrow = jest.fn();
const mockPersistPageFailure = jest.fn();
const mockMarkRunFailure = jest.fn();
const mockMarkRunControlStatus = jest.fn();
const mockCompleteRun = jest.fn();
const mockProcessSuccessfulPage = jest.fn();
const mockGetEncodedWigleAuth = jest.fn();
const mockSleep = jest.fn();
const mockGetAdaptiveDelay = jest.fn();
const mockFetchWiglePage = jest.fn();
const mockNormalizeImportParams = jest.fn();

jest.mock('../../server/src/services/wigleImport/runRepository', () => ({
  reconcileRunProgress: (...args: any[]) => mockReconcileRunProgress(...args),
  getRunOrThrow: (...args: any[]) => mockGetRunOrThrow(...args),
  persistPageFailure: (...args: any[]) => mockPersistPageFailure(...args),
  markRunFailure: (...args: any[]) => mockMarkRunFailure(...args),
  markRunControlStatus: (...args: any[]) => mockMarkRunControlStatus(...args),
  completeRun: (...args: any[]) => mockCompleteRun(...args),
}));

jest.mock('../../server/src/services/wigleImport/params', () => ({
  DEFAULT_RESULTS_PER_PAGE: 100,
  normalizeImportParams: (...args: any[]) => mockNormalizeImportParams(...args),
}));

jest.mock('../../server/src/services/wigleImport/pageProcessor', () => ({
  processSuccessfulPage: (...args: any[]) => mockProcessSuccessfulPage(...args),
}));

jest.mock('../../server/src/services/wigleImport/authProvider', () => ({
  getEncodedWigleAuth: (...args: any[]) => mockGetEncodedWigleAuth(...args),
}));

jest.mock('../../server/src/services/wigleImport/rateLimitingStrategy', () => ({
  getAdaptiveDelay: (...args: any[]) => mockGetAdaptiveDelay(...args),
  sleep: (...args: any[]) => mockSleep(...args),
}));

jest.mock('../../server/src/services/wigleImport/wigleApiClient', () => ({
  fetchWiglePage: (...args: any[]) => mockFetchWiglePage(...args),
}));

describe('WigleImportRunOrchestrator', () => {
  const getOrchestrator = () =>
    require('../../server/src/services/wigleImport/orchestrators/WigleImportRunOrchestrator')
      .WigleImportRunOrchestrator;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    mockNormalizeImportParams.mockImplementation((params: Record<string, unknown>) => ({
      resultsPerPage: 100,
      ...params,
    }));
    mockGetEncodedWigleAuth.mockReturnValue('encoded-auth');
    mockGetAdaptiveDelay.mockReturnValue(0);
    mockSleep.mockResolvedValue(undefined);
    mockPersistPageFailure.mockResolvedValue(undefined);
    mockMarkRunFailure.mockResolvedValue({ id: 1, status: 'failed' });
    mockMarkRunControlStatus.mockResolvedValue({ id: 1, status: 'paused' });
    mockCompleteRun.mockResolvedValue({ id: 1, status: 'completed' });
    mockProcessSuccessfulPage.mockResolvedValue({ id: 1, status: 'running' });
  });

  it('returns a completed run without fetching new pages', async () => {
    mockReconcileRunProgress.mockResolvedValue({ id: 1, status: 'completed' });

    const Orchestrator = getOrchestrator();
    const orchestrator = new Orchestrator();

    const result = await orchestrator.execute(1);

    expect(result).toEqual({ id: 1, status: 'completed' });
    expect(mockFetchWiglePage).not.toHaveBeenCalled();
  });

  it('completes the run when the first page returns no results and no next cursor', async () => {
    mockReconcileRunProgress.mockResolvedValue({
      id: 2,
      status: 'running',
      request_params: { ssid: 'empty-test', resultsPerPage: 100 },
    });
    mockGetRunOrThrow.mockResolvedValue({
      id: 2,
      status: 'running',
      next_page: 1,
      api_cursor: null,
      state: 'US',
      search_term: 'empty-test',
      api_total_results: null,
    });
    mockFetchWiglePage.mockResolvedValue({
      results: [],
      search_after: null,
      totalResults: 0,
    });
    mockCompleteRun.mockResolvedValue({ id: 2, status: 'completed' });

    const Orchestrator = getOrchestrator();
    const orchestrator = new Orchestrator();

    const result = await orchestrator.execute(2);

    expect(mockCompleteRun).toHaveBeenCalledWith(
      2,
      'No records returned on first page — API quota may be exhausted or no results match the search'
    );
    expect(result).toEqual({ id: 2, status: 'completed' });
    expect(mockPersistPageFailure).not.toHaveBeenCalled();
  });

  it('pauses the run after a repeated 429 response', async () => {
    mockReconcileRunProgress.mockResolvedValue({
      id: 3,
      status: 'running',
      request_params: { ssid: 'rate-limit-test', resultsPerPage: 100 },
    });
    mockGetRunOrThrow.mockResolvedValue({
      id: 3,
      status: 'running',
      next_page: 1,
      api_cursor: null,
      state: 'US',
      search_term: 'rate-limit-test',
      api_total_results: null,
    });
    mockFetchWiglePage
      .mockRejectedValueOnce({ status: 429, retryAfter: '1', message: 'rate limited' })
      .mockRejectedValueOnce({ status: 429, retryAfter: '1', message: 'rate limited again' });

    const Orchestrator = getOrchestrator();
    const orchestrator = new Orchestrator();

    const result = await orchestrator.execute(3);

    expect(mockSleep).toHaveBeenCalled();
    expect(mockPersistPageFailure).toHaveBeenCalledWith(3, 1, null, 'rate limited again');
    expect(mockMarkRunControlStatus).toHaveBeenCalledWith(3, 'paused');
    expect(result).toEqual({ id: 1, status: 'paused' });
  });

  describe('Issue 1: Transient error failure semantics & bounded retry', () => {
    const originalEnv = process.env;

    afterEach(() => {
      process.env = originalEnv;
    });

    it('retries once on transient timeout (AbortError) and continues run when retry succeeds, asserting backoff order', async () => {
      delete process.env.WIGLE_IMPORT_TRANSIENT_RETRIES;
      const runId = 414;

      mockReconcileRunProgress.mockResolvedValue({
        id: runId,
        status: 'running',
        request_params: { ssidlike: '%fbi%', region: 'MI', resultsPerPage: 100 },
      });
      mockGetRunOrThrow.mockResolvedValue({
        id: runId,
        status: 'running',
        next_page: 1,
        api_cursor: null,
        state: 'MI',
        search_term: '%fbi%',
        api_total_results: 100,
      });

      const timeoutErr: any = new Error('timeout after 60012ms');
      timeoutErr.name = 'AbortError';
      timeoutErr.isTimeout = true;

      mockFetchWiglePage.mockRejectedValueOnce(timeoutErr).mockResolvedValueOnce({
        results: [{ bssid: '00:11:22:33:44:55', ssid: '%fbi%' }],
        search_after: 'cursor_page2',
        totalResults: 100,
      });

      const Orchestrator = getOrchestrator();
      const orchestrator = new Orchestrator();

      // Stop after processing page 1 to prevent infinite loop
      mockProcessSuccessfulPage.mockImplementationOnce(async () => {
        mockGetRunOrThrow.mockResolvedValueOnce({
          id: runId,
          status: 'paused',
          next_page: 2,
          api_cursor: 'cursor_page2',
        });
        return { id: runId, status: 'paused' };
      });

      await orchestrator.execute(runId);

      expect(mockFetchWiglePage).toHaveBeenCalledTimes(2);

      // Verify strict invocation ordering: fetch1 -> sleep(15000) -> fetch2
      const firstFetchOrder = mockFetchWiglePage.mock.invocationCallOrder[0];
      const sleepOrder = mockSleep.mock.invocationCallOrder[0];
      const secondFetchOrder = mockFetchWiglePage.mock.invocationCallOrder[1];

      expect(firstFetchOrder).toBeLessThan(sleepOrder);
      expect(sleepOrder).toBeLessThan(secondFetchOrder);
      expect(mockSleep).toHaveBeenCalledWith(15_000);
      expect(mockMarkRunFailure).not.toHaveBeenCalled();
    });

    it('pauses run and preserves last_error on run row when transient retries are exhausted', async () => {
      delete process.env.WIGLE_IMPORT_TRANSIENT_RETRIES;
      const runId = 414;

      mockReconcileRunProgress.mockResolvedValue({
        id: runId,
        status: 'running',
        request_params: { ssidlike: '%fbi%', region: 'MI', resultsPerPage: 100 },
      });
      mockGetRunOrThrow.mockResolvedValue({
        id: runId,
        status: 'running',
        next_page: 56,
        api_cursor: 'cursor_55',
        state: 'MI',
        search_term: '%fbi%',
        api_total_results: 37203,
      });

      const timeoutErr: any = new Error('timeout after 60015ms');
      timeoutErr.name = 'AbortError';
      timeoutErr.isTimeout = true;

      mockFetchWiglePage.mockRejectedValueOnce(timeoutErr).mockRejectedValueOnce(timeoutErr);

      mockMarkRunControlStatus.mockResolvedValueOnce({
        id: runId,
        status: 'paused',
        last_error: 'timeout after 60015ms',
      });

      const Orchestrator = getOrchestrator();
      const orchestrator = new Orchestrator();

      const result = await orchestrator.execute(runId);

      expect(mockFetchWiglePage).toHaveBeenCalledTimes(2);
      expect(mockPersistPageFailure).toHaveBeenCalledWith(
        runId,
        56,
        'cursor_55',
        'timeout after 60015ms'
      );
      // Assert markRunControlStatus called with 3rd argument (errorMessage) to persist last_error on the run row
      expect(mockMarkRunControlStatus).toHaveBeenCalledWith(
        runId,
        'paused',
        'timeout after 60015ms'
      );
      expect(mockMarkRunFailure).not.toHaveBeenCalled();
      expect(result).toEqual(
        expect.objectContaining({
          id: runId,
          status: 'paused',
          last_error: 'timeout after 60015ms',
        })
      );
    });

    it('retries once on upstream HTTP 502/503/504 and pauses on exhaustion with last_error', async () => {
      delete process.env.WIGLE_IMPORT_TRANSIENT_RETRIES;
      const runId = 387;

      mockReconcileRunProgress.mockResolvedValue({
        id: runId,
        status: 'running',
        request_params: { ssidlike: '%fbi%', resultsPerPage: 100 },
      });
      mockGetRunOrThrow.mockResolvedValue({
        id: runId,
        status: 'running',
        next_page: 1,
        api_cursor: null,
        state: null,
        search_term: '%fbi%',
        api_total_results: null,
      });

      const gatewayErr: any = new Error('HTTP 502: Bad Gateway');
      gatewayErr.status = 502;

      mockFetchWiglePage.mockRejectedValueOnce(gatewayErr).mockRejectedValueOnce(gatewayErr);

      mockMarkRunControlStatus.mockResolvedValueOnce({
        id: runId,
        status: 'paused',
        last_error: 'HTTP 502: Bad Gateway',
      });

      const Orchestrator = getOrchestrator();
      const orchestrator = new Orchestrator();

      const result = await orchestrator.execute(runId);

      expect(mockFetchWiglePage).toHaveBeenCalledTimes(2);
      expect(mockMarkRunControlStatus).toHaveBeenCalledWith(
        runId,
        'paused',
        'HTTP 502: Bad Gateway'
      );
      expect(mockMarkRunFailure).not.toHaveBeenCalled();
      expect(result).toEqual(
        expect.objectContaining({
          id: runId,
          status: 'paused',
          last_error: 'HTTP 502: Bad Gateway',
        })
      );
    });

    it('retries network reset ECONNRESET/ETIMEDOUT/UND_ERR_CONNECT_TIMEOUT and pauses on exhaustion', async () => {
      delete process.env.WIGLE_IMPORT_TRANSIENT_RETRIES;
      const runId = 391;

      mockReconcileRunProgress.mockResolvedValue({
        id: runId,
        status: 'running',
        request_params: { ssidlike: '%fbi%', region: 'AZ', resultsPerPage: 100 },
      });
      mockGetRunOrThrow.mockResolvedValue({
        id: runId,
        status: 'running',
        next_page: 12,
        api_cursor: 'cursor_11',
        state: 'AZ',
        search_term: '%fbi%',
        api_total_results: null,
      });

      const connErr: any = new Error('read ECONNRESET');
      connErr.code = 'ECONNRESET';

      mockFetchWiglePage.mockRejectedValueOnce(connErr).mockRejectedValueOnce(connErr);

      mockMarkRunControlStatus.mockResolvedValueOnce({
        id: runId,
        status: 'paused',
        last_error: 'read ECONNRESET',
      });

      const Orchestrator = getOrchestrator();
      const orchestrator = new Orchestrator();

      const result = await orchestrator.execute(runId);

      expect(mockFetchWiglePage).toHaveBeenCalledTimes(2);
      expect(mockMarkRunControlStatus).toHaveBeenCalledWith(runId, 'paused', 'read ECONNRESET');
      expect(mockMarkRunFailure).not.toHaveBeenCalled();
      expect(result).toEqual(expect.objectContaining({ id: runId, status: 'paused' }));
    });

    it('does not retry and immediately marks run failed on 401/403 auth error', async () => {
      const runId = 390;

      mockReconcileRunProgress.mockResolvedValue({
        id: runId,
        status: 'running',
        request_params: { ssidlike: 'bad-auth', resultsPerPage: 100 },
      });
      mockGetRunOrThrow.mockResolvedValue({
        id: runId,
        status: 'running',
        next_page: 1,
        api_cursor: null,
        state: 'AK',
        search_term: 'bad-auth',
        api_total_results: null,
      });

      const authErr: any = new Error('HTTP 401: Unauthorized');
      authErr.status = 401;

      mockFetchWiglePage.mockRejectedValueOnce(authErr);
      mockMarkRunFailure.mockResolvedValueOnce({ id: runId, status: 'failed' });

      const Orchestrator = getOrchestrator();
      const orchestrator = new Orchestrator();

      const result = await orchestrator.execute(runId);

      expect(mockFetchWiglePage).toHaveBeenCalledTimes(1);
      expect(mockSleep).not.toHaveBeenCalledWith(15_000);
      expect(mockMarkRunFailure).toHaveBeenCalledWith(runId, 'HTTP 401: Unauthorized');
      expect(result).toEqual({ id: runId, status: 'failed' });
    });

    it('cancel-during-backoff: exits cleanly without second fetch when run is cancelled during backoff', async () => {
      delete process.env.WIGLE_IMPORT_TRANSIENT_RETRIES;
      const runId = 414;

      mockReconcileRunProgress.mockResolvedValue({
        id: runId,
        status: 'running',
        request_params: { ssidlike: '%fbi%', region: 'MI', resultsPerPage: 100 },
      });

      // Initial check is running, but check after backoff sleep reveals cancelled
      mockGetRunOrThrow
        .mockResolvedValueOnce({
          id: runId,
          status: 'running',
          next_page: 10,
          api_cursor: 'cursor_9',
          state: 'MI',
          search_term: '%fbi%',
          api_total_results: 1000,
        })
        .mockResolvedValueOnce({
          id: runId,
          status: 'cancelled',
          next_page: 10,
          api_cursor: 'cursor_9',
          state: 'MI',
          search_term: '%fbi%',
          api_total_results: 1000,
        });

      const timeoutErr: any = new Error('timeout after 60000ms');
      timeoutErr.name = 'AbortError';

      mockFetchWiglePage.mockRejectedValueOnce(timeoutErr);

      const Orchestrator = getOrchestrator();
      const orchestrator = new Orchestrator();

      const result = await orchestrator.execute(runId);

      expect(mockFetchWiglePage).toHaveBeenCalledTimes(1);
      expect(mockSleep).toHaveBeenCalledWith(15_000);
      expect(mockPersistPageFailure).not.toHaveBeenCalled();
      expect(mockMarkRunFailure).not.toHaveBeenCalled();
      expect(result).toEqual(expect.objectContaining({ id: runId, status: 'cancelled' }));
    });

    it('retry-blocked-by-local-gate: pauses immediately without extra sleep when retry hits local soft limit', async () => {
      delete process.env.WIGLE_IMPORT_TRANSIENT_RETRIES;
      const runId = 414;

      mockReconcileRunProgress.mockResolvedValue({
        id: runId,
        status: 'running',
        request_params: { ssidlike: '%fbi%', region: 'MI', resultsPerPage: 100 },
      });
      mockGetRunOrThrow.mockResolvedValue({
        id: runId,
        status: 'running',
        next_page: 50,
        api_cursor: 'cursor_49',
        state: 'MI',
        search_term: '%fbi%',
        api_total_results: 1000,
      });

      const timeoutErr: any = new Error('timeout after 60000ms');
      timeoutErr.name = 'AbortError';

      const localGateErr: any = new Error('WiGLE search soft limit reached (50/50).');
      localGateErr.status = 429;

      mockFetchWiglePage.mockRejectedValueOnce(timeoutErr).mockRejectedValueOnce(localGateErr);

      mockMarkRunControlStatus.mockResolvedValueOnce({
        id: runId,
        status: 'paused',
        last_error: 'WiGLE search soft limit reached (50/50).',
      });

      const Orchestrator = getOrchestrator();
      const orchestrator = new Orchestrator();

      const result = await orchestrator.execute(runId);

      expect(mockFetchWiglePage).toHaveBeenCalledTimes(2);
      // Sleep called for transient backoff (15s), but NOT for 429 retry delay (60s+)
      expect(mockSleep).toHaveBeenCalledTimes(1);
      expect(mockSleep).toHaveBeenCalledWith(15_000);
      expect(mockMarkRunControlStatus).toHaveBeenCalledWith(runId, 'paused');
      expect(mockMarkRunFailure).not.toHaveBeenCalled();
      expect(result).toEqual(expect.objectContaining({ id: runId, status: 'paused' }));
    });

    it('retries=0: immediately pauses on transient failure when WIGLE_IMPORT_TRANSIENT_RETRIES=0', async () => {
      process.env.WIGLE_IMPORT_TRANSIENT_RETRIES = '0';
      const runId = 414;

      mockReconcileRunProgress.mockResolvedValue({
        id: runId,
        status: 'running',
        request_params: { ssidlike: '%fbi%', region: 'MI', resultsPerPage: 100 },
      });
      mockGetRunOrThrow.mockResolvedValue({
        id: runId,
        status: 'running',
        next_page: 5,
        api_cursor: 'cursor_4',
        state: 'MI',
        search_term: '%fbi%',
        api_total_results: 1000,
      });

      const timeoutErr: any = new Error('timeout after 60000ms');
      timeoutErr.name = 'AbortError';

      mockFetchWiglePage.mockRejectedValueOnce(timeoutErr);

      mockMarkRunControlStatus.mockResolvedValueOnce({
        id: runId,
        status: 'paused',
        last_error: 'timeout after 60000ms',
      });

      const Orchestrator = getOrchestrator();
      const orchestrator = new Orchestrator();

      const result = await orchestrator.execute(runId);

      expect(mockFetchWiglePage).toHaveBeenCalledTimes(1);
      expect(mockSleep).not.toHaveBeenCalledWith(15_000);
      expect(mockMarkRunControlStatus).toHaveBeenCalledWith(
        runId,
        'paused',
        'timeout after 60000ms'
      );
      expect(mockMarkRunFailure).not.toHaveBeenCalled();
      expect(result).toEqual(
        expect.objectContaining({
          id: runId,
          status: 'paused',
          last_error: 'timeout after 60000ms',
        })
      );
    });
  });
});
