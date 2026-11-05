import { fetchBtPage } from '../../../../server/src/services/wigleImport/btApiClient';
import { wigleGatewayFetch } from '../../../../server/src/services/wigle/wigleGateway';
import { buildBtSearchParams } from '../../../../server/src/services/wigleImport/btParams';
import { updateLedgerOutcome } from '../../../../server/src/services/wigleRequestLedger';

jest.mock('../../../../server/src/services/wigle/wigleGateway', () => ({
  wigleGatewayFetch: jest.fn(),
}));

jest.mock('../../../../server/src/services/wigleImport/btParams', () => ({
  buildBtSearchParams: jest.fn(),
}));

jest.mock('../../../../server/src/services/wigleRequestLedger', () => ({
  updateLedgerOutcome: jest.fn(),
}));

jest.mock('../../../../server/src/logging/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

describe('btApiClient', () => {
  const encodedAuth = 'dGVzdDp0ZXN0';
  const requestParams = {
    namelike: 'test',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (buildBtSearchParams as jest.Mock).mockReturnValue(new URLSearchParams({ namelike: 'test' }));
  });

  it('successfully fetches a page and updates ledger with page results count', async () => {
    const mockJsonResponse = {
      success: true,
      results: [{ netid: '1' }, { netid: '2' }],
      totalResults: 5000,
    };

    (wigleGatewayFetch as jest.Mock).mockResolvedValue({
      ok: true,
      latencyMs: 142,
      ledgerId: 789,
      response: {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue(mockJsonResponse),
      },
    });

    const result = await fetchBtPage(encodedAuth, requestParams, null);

    expect(result).toEqual(mockJsonResponse);
    expect(wigleGatewayFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringContaining('bluetooth/search'),
      })
    );
    // Verifies result_count is current-page records (2), NOT totalResults (5000)
    expect(updateLedgerOutcome).toHaveBeenCalledWith('search', 789, {
      status: 'success',
      duration_ms: 142,
      http_status: 200,
      result_count: 2,
    });
  });

  it('records successful zero-result page when results array is empty', async () => {
    const mockJsonResponse = {
      success: true,
      results: [],
      totalResults: 0,
    };

    (wigleGatewayFetch as jest.Mock).mockResolvedValue({
      ok: true,
      latencyMs: 88,
      ledgerId: 790,
      response: {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue(mockJsonResponse),
      },
    });

    const result = await fetchBtPage(encodedAuth, requestParams, null);

    expect(result).toEqual(mockJsonResponse);
    expect(updateLedgerOutcome).toHaveBeenCalledWith('search', 790, {
      status: 'success',
      duration_ms: 88,
      http_status: 200,
      result_count: 0,
    });
  });

  it('records failure in ledger and throws when response JSON is malformed', async () => {
    (wigleGatewayFetch as jest.Mock).mockResolvedValue({
      ok: true,
      latencyMs: 50,
      ledgerId: 791,
      response: {
        ok: true,
        status: 200,
        json: jest.fn().mockRejectedValue(new SyntaxError('Unexpected token < in JSON')),
      },
    });

    await expect(fetchBtPage(encodedAuth, requestParams, null)).rejects.toThrow(
      'Unexpected token < in JSON'
    );

    expect(updateLedgerOutcome).toHaveBeenCalledWith('search', 791, {
      status: 'error',
      duration_ms: 50,
      http_status: 200,
      error_message: expect.stringContaining('Malformed JSON response'),
    });
  });

  it('records failure in ledger and throws when API returns success: false', async () => {
    const mockJsonResponse = {
      success: false,
      message: 'Too many queries today',
      results: [],
    };

    (wigleGatewayFetch as jest.Mock).mockResolvedValue({
      ok: true,
      latencyMs: 110,
      ledgerId: 792,
      response: {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue(mockJsonResponse),
      },
    });

    await expect(fetchBtPage(encodedAuth, requestParams, null)).rejects.toThrow(
      'Too many queries today'
    );

    expect(updateLedgerOutcome).toHaveBeenCalledWith('search', 792, {
      status: 'error',
      duration_ms: 110,
      http_status: 200,
      error_message: 'Too many queries today',
    });
  });

  it('records failure in ledger and throws when results array is missing', async () => {
    const mockJsonResponse = {
      success: true,
      // results missing entirely
    };

    (wigleGatewayFetch as jest.Mock).mockResolvedValue({
      ok: true,
      latencyMs: 95,
      ledgerId: 793,
      response: {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue(mockJsonResponse),
      },
    });

    await expect(fetchBtPage(encodedAuth, requestParams, null)).rejects.toThrow(
      'Malformed WiGLE BT response: missing or invalid results array'
    );

    expect(updateLedgerOutcome).toHaveBeenCalledWith('search', 793, {
      status: 'error',
      duration_ms: 95,
      http_status: 200,
      error_message: 'Malformed WiGLE BT response: missing or invalid results array',
    });
  });

  it('throws error if gateway result is not ok', async () => {
    (wigleGatewayFetch as jest.Mock).mockResolvedValue({
      ok: false,
      error: 'Gateway Timeout',
      status: 504,
    });

    try {
      await fetchBtPage(encodedAuth, requestParams, null);
      fail('Should have thrown');
    } catch (error: any) {
      expect(error.message).toBe('Gateway Timeout');
      expect(error.status).toBe(504);
    }
  });

  it('throws error if response is not ok', async () => {
    (wigleGatewayFetch as jest.Mock).mockResolvedValue({
      ok: true,
      response: {
        ok: false,
        status: 429,
        text: jest.fn().mockResolvedValue('Too Many Requests'),
        headers: {
          get: jest.fn().mockReturnValue('3600'),
        },
      },
    });

    try {
      await fetchBtPage(encodedAuth, requestParams, 'cursor1');
      fail('Should have thrown');
    } catch (error: any) {
      expect(error.message).toContain('failed with status 429');
      expect(error.status).toBe(429);
      expect(error.retryAfter).toBe('3600');
    }
  });
});
