export {};

jest.mock('../../../server/src/services/wigleClient', () => ({
  fetchWigle: jest.fn(),
}));

jest.mock('../../../server/src/services/wigleAuditLogger', () => ({
  logWigleAuditEvent: jest.fn(),
}));

jest.mock('../../../server/src/logging/logger', () => ({
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
}));

import { wigleGatewayFetch } from '../../../server/src/services/wigle/wigleGateway';
import { WigleValidationError } from '../../../server/src/services/wigleImport/wigleApiSpec';

const { fetchWigle } = require('../../../server/src/services/wigleClient');
const wigleRequestLedger = require('../../../server/src/services/wigleRequestLedger');
const { logWigleAuditEvent } = require('../../../server/src/services/wigleAuditLogger');

// Mock validateWigleSearchParams so we can control validation exceptions
jest.mock('../../../server/src/services/wigleImport/wigleApiSpec', () => {
  const original = jest.requireActual('../../../server/src/services/wigleImport/wigleApiSpec');
  return {
    ...original,
    validateWigleSearchParams: jest.fn(),
  };
});
const {
  validateWigleSearchParams,
} = require('../../../server/src/services/wigleImport/wigleApiSpec');

describe('wigleGateway — stats quota gate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns 429 before fetchWigle when stats soft limit is hit', async () => {
    jest.spyOn(wigleRequestLedger, 'updateLedgerOutcome').mockImplementation(() => {});
    jest.spyOn(wigleRequestLedger, 'assertCanRequest').mockImplementation((kind: unknown) => {
      if (kind === 'stats') {
        const e: any = new Error('WiGLE stats soft limit reached (10/10).');
        e.status = 429;
        throw e;
      }
    });

    const result = await wigleGatewayFetch({
      kind: 'stats',
      url: 'https://api.wigle.net/api/v2/profile/user',
      entrypoint: 'stats-test',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(429);
      expect(result.error).toContain('soft limit');
    }
    expect(fetchWigle).not.toHaveBeenCalled();
    expect(wigleRequestLedger.updateLedgerOutcome).not.toHaveBeenCalled();
  });

  it('calls fetchWigle for stats after assertCanRequest passes', async () => {
    jest.spyOn(wigleRequestLedger, 'updateLedgerOutcome').mockImplementation(() => {});
    const mockResponse = {
      ok: true,
      status: 200,
      clone: () => mockResponse,
      headers: new Headers(),
    };
    (fetchWigle as jest.Mock).mockResolvedValue({ response: mockResponse, ledgerId: 1 });

    const result = await wigleGatewayFetch({
      kind: 'stats',
      url: 'https://api.wigle.net/api/v2/profile/user',
      entrypoint: 'stats-test',
    });

    expect(result.ok).toBe(true);
    expect(fetchWigle).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'stats', url: 'https://api.wigle.net/api/v2/profile/user' })
    );
  });
});

describe('wigleGateway — search params validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns false when validateWigleSearchParams throws WigleValidationError', async () => {
    validateWigleSearchParams.mockImplementationOnce(() => {
      throw new WigleValidationError('Invalid param', 'testKey', 'testVal');
    });

    const result = await wigleGatewayFetch({
      kind: 'search',
      url: 'https://api.wigle.net/api/v2/network/search',
      searchParams: new URLSearchParams('testKey=testVal'),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.validationError).toBe(true);
      expect(result.error).toBe('Invalid param');
    }
    expect(logWigleAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'VALIDATION_ERROR' })
    );
  });

  it('throws other errors from validation', async () => {
    validateWigleSearchParams.mockImplementationOnce(() => {
      throw new Error('Some unexpected error');
    });

    await expect(
      wigleGatewayFetch({
        kind: 'search',
        url: 'https://api.wigle.net/api/v2/network/search',
        searchParams: new URLSearchParams('testKey=testVal'),
      })
    ).rejects.toThrow('Some unexpected error');
  });
});

describe('wigleGateway — fetchWigle responses and errors', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(wigleRequestLedger, 'updateLedgerOutcome').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('parses Retry-After header correctly on 429 response', async () => {
    const mockHeaders = new Headers();
    mockHeaders.set('Retry-After', '60');

    const mockResponse = {
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      clone: () => mockResponse,
      headers: mockHeaders,
    };
    (fetchWigle as jest.Mock).mockResolvedValue({ response: mockResponse, ledgerId: 123 });

    const result = await wigleGatewayFetch({
      kind: 'search',
      url: 'https://api.wigle.net/api/v2/network/search',
    });

    expect(result.ok).toBe(true);
    expect(wigleRequestLedger.updateLedgerOutcome).toHaveBeenCalledWith(
      'search',
      123,
      expect.objectContaining({
        status: 'rate_limited',
        http_status: 429,
        retry_after_hint: 60,
      })
    );
  });

  it.each([
    { status: 200, ok: true, expectedLedgerStatus: 'success' },
    { status: 500, ok: false, expectedLedgerStatus: 'error' },
    { status: 403, ok: false, expectedLedgerStatus: 'error' },
  ])(
    'records returned HTTP $status as $expectedLedgerStatus',
    async ({ status, ok, expectedLedgerStatus }) => {
      const mockResponse = {
        ok,
        status,
        statusText: status === 200 ? 'OK' : 'response error',
        clone: () => mockResponse,
        headers: new Headers(),
      };
      (fetchWigle as jest.Mock).mockResolvedValue({ response: mockResponse, ledgerId: 456 });

      const result = await wigleGatewayFetch({
        kind: 'search',
        url: 'https://api.wigle.net/api/v2/network/search',
      });

      expect(result.ok).toBe(true);
      expect(wigleRequestLedger.updateLedgerOutcome).toHaveBeenCalledWith(
        'search',
        456,
        expect.objectContaining({
          status: expectedLedgerStatus,
          http_status: status,
        })
      );
    }
  );

  it('ignores invalid Retry-After header', async () => {
    const mockHeaders = new Headers();
    mockHeaders.set('Retry-After', 'invalid');

    const mockResponse = {
      ok: false,
      status: 429,
      clone: () => mockResponse,
      headers: mockHeaders,
    };
    (fetchWigle as jest.Mock).mockResolvedValue({ response: mockResponse, ledgerId: 123 });

    const result = await wigleGatewayFetch({
      kind: 'search',
      url: 'https://api.wigle.net/api/v2/network/search',
    });

    expect(result.ok).toBe(true);
    expect(wigleRequestLedger.updateLedgerOutcome).toHaveBeenCalledWith(
      'search',
      123,
      expect.objectContaining({ retry_after_hint: null })
    );
  });

  it('handles AbortError timeout from fetchWigle', async () => {
    const abortErr: any = new Error('The operation was aborted');
    abortErr.name = 'AbortError';
    abortErr.ledgerId = 23;

    (fetchWigle as jest.Mock).mockRejectedValue(abortErr);

    const result = await wigleGatewayFetch({
      kind: 'search',
      url: 'https://api.wigle.net/api/v2/network/search',
    });

    expect(result.ok).toBe(false);
    expect(wigleRequestLedger.updateLedgerOutcome).toHaveBeenCalledWith(
      'search',
      23,
      expect.objectContaining({
        status: 'error',
        error_message: expect.stringMatching(/^timeout after/),
      })
    );
  });

  it('does not update a ledger row when an error has no ledger ID', async () => {
    const quotaError: any = new Error('WiGLE search soft limit reached');
    quotaError.status = 429;

    (fetchWigle as jest.Mock).mockRejectedValue(quotaError);

    const result = await wigleGatewayFetch({
      kind: 'search',
      url: 'https://api.wigle.net/api/v2/network/search',
    });

    expect(result.ok).toBe(false);
    expect(wigleRequestLedger.updateLedgerOutcome).not.toHaveBeenCalled();
  });

  it('handles regular fetch error with status code', async () => {
    const apiErr: any = new Error('Internal Server Error');
    apiErr.status = 500;
    apiErr.ledgerId = 34;

    (fetchWigle as jest.Mock).mockRejectedValue(apiErr);

    const result = await wigleGatewayFetch({
      kind: 'search',
      url: 'https://api.wigle.net/api/v2/network/search',
    });

    expect(result.ok).toBe(false);
    expect(wigleRequestLedger.updateLedgerOutcome).toHaveBeenCalledWith(
      'search',
      34,
      expect.objectContaining({
        status: 'error',
        http_status: 500,
        error_message: 'HTTP 500: Internal Server Error',
      })
    );
  });
});
