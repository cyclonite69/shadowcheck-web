export {};

const mockWigleGatewayFetch = jest.fn();
const mockLoggerInfo = jest.fn();
const mockLoggerError = jest.fn();

jest.mock('../../server/src/logging/logger', () => ({
  info: (...args: any[]) => mockLoggerInfo(...args),
  error: (...args: any[]) => mockLoggerError(...args),
  warn: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('../../server/src/services/wigle/wigleGateway', () => ({
  wigleGatewayFetch: (...args: any[]) => mockWigleGatewayFetch(...args),
}));

jest.mock('../../server/src/services/wigleRequestLedger', () => ({
  updateLedgerOutcome: jest.fn(),
}));

describe('wigleSearchApiService boundary & timeout contracts', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  const getService = () => require('../../server/src/services/wigleSearchApiService');

  it('uses default 60000ms timeout for import-run search requests', async () => {
    delete process.env.WIGLE_IMPORT_SEARCH_TIMEOUT_MS;
    const { fetchWigleSearchPage } = getService();

    mockWigleGatewayFetch.mockResolvedValueOnce({
      ok: true,
      response: {
        ok: true,
        status: 200,
        text: async () => '',
        json: async () => ({ success: true, results: [] }),
      },
      latencyMs: 120,
      ledgerId: 101,
    });

    const params = new URLSearchParams({ ssidlike: '%fbi%', region: 'MI' });
    await fetchWigleSearchPage({
      encodedAuth: 'test-auth',
      apiVer: 'v2',
      params,
      entrypoint: 'import-run',
    });

    expect(mockWigleGatewayFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'search',
        timeoutMs: 60000,
        maxRetries: 0,
        entrypoint: 'import-run',
      })
    );
  });

  it('respects WIGLE_IMPORT_SEARCH_TIMEOUT_MS env override', async () => {
    process.env.WIGLE_IMPORT_SEARCH_TIMEOUT_MS = '75000';
    const { fetchWigleSearchPage } = getService();

    mockWigleGatewayFetch.mockResolvedValueOnce({
      ok: true,
      response: {
        ok: true,
        status: 200,
        text: async () => '',
        json: async () => ({ success: true, results: [] }),
      },
      latencyMs: 200,
      ledgerId: 102,
    });

    const params = new URLSearchParams({ ssidlike: '%fbi%', region: 'AZ' });
    await fetchWigleSearchPage({
      encodedAuth: 'test-auth',
      apiVer: 'v2',
      params,
      entrypoint: 'import-run',
    });

    expect(mockWigleGatewayFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'search',
        timeoutMs: 75000,
        maxRetries: 0,
        entrypoint: 'import-run',
      })
    );
  });

  it('keeps 30000ms timeout for non-import-run entrypoints (manual search)', async () => {
    const { fetchWigleSearchPage } = getService();

    mockWigleGatewayFetch.mockResolvedValueOnce({
      ok: true,
      response: {
        ok: true,
        status: 200,
        text: async () => '',
        json: async () => ({ success: true, results: [] }),
      },
      latencyMs: 50,
      ledgerId: 103,
    });

    const params = new URLSearchParams({ ssidlike: 'fbi%' });
    await fetchWigleSearchPage({
      encodedAuth: 'test-auth',
      apiVer: 'v2',
      params,
      entrypoint: 'manual-search',
    });

    expect(mockWigleGatewayFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'search',
        timeoutMs: 30000,
        maxRetries: 1,
        entrypoint: 'manual-search',
      })
    );
  });

  it('forwards status, isTimeout, and code on error gatewayResult', async () => {
    const { fetchWigleSearchPage } = getService();

    mockWigleGatewayFetch.mockResolvedValueOnce({
      ok: false,
      error: 'timeout after 60012ms',
      status: undefined,
      isTimeout: true,
      code: 'ETIMEDOUT',
    });

    const params = new URLSearchParams({ ssidlike: '%fbi%' });

    await expect(
      fetchWigleSearchPage({
        encodedAuth: 'test-auth',
        apiVer: 'v2',
        params,
        entrypoint: 'import-run',
      })
    ).rejects.toMatchObject({
      message: 'timeout after 60012ms',
      isTimeout: true,
      code: 'ETIMEDOUT',
    });
  });
});
