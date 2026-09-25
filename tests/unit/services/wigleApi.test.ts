export {};

jest.mock('../../../server/src/config/database', () => ({
  query: jest.fn(),
}));

jest.mock('../../../server/src/services/wigle/wigleGateway', () => ({
  wigleGatewayFetch: jest.fn(),
}));

jest.mock('../../../server/src/services/secretsManager', () => {
  const mockGet = jest.fn();
  return {
    __esModule: true,
    default: { get: mockGet },
    get: mockGet,
  };
});

jest.mock('../../../server/src/services/wigleRequestUtils', () => ({
  hashRecord: jest.fn().mockReturnValue('hash123'),
}));

import { getUserStats } from '../../../server/src/services/wigle/api';
const { wigleGatewayFetch } = require('../../../server/src/services/wigle/wigleGateway');
const secretsManagerModule = require('../../../server/src/services/secretsManager');
const mockGet: jest.Mock = secretsManagerModule.default.get;

const mockResponse = (ok: boolean, data: any, status = 200) => ({
  ok,
  status,
  json: () => Promise.resolve(data),
});

describe('wigle/api — getUserStats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('throws when wigle_api_name is missing', async () => {
    mockGet.mockReturnValue(null);
    await expect(getUserStats()).rejects.toThrow('WiGLE API credentials not configured');
  });

  test('throws when wigle_api_token is missing', async () => {
    mockGet.mockReturnValueOnce('myname').mockReturnValueOnce(null);
    await expect(getUserStats()).rejects.toThrow('WiGLE API credentials not configured');
  });

  test('calls the correct WiGLE profile/user URL', async () => {
    mockGet.mockReturnValue('value');
    wigleGatewayFetch.mockResolvedValue({
      ok: true,
      response: mockResponse(true, { success: true }),
    });
    await getUserStats();
    const callArgs = wigleGatewayFetch.mock.calls[0][0];
    expect(callArgs.url).toBe('https://api.wigle.net/api/v2/stats/user');
  });

  test('returns normalized user stats on success', async () => {
    mockGet.mockReturnValue('value');
    const mockRaw = {
      success: true,
      statistics: {
        userName: 'testuser',
        rank: 123,
        discoveredWiFiGPS: 10,
        discoveredBtGPS: 20,
        discoveredCellGPS: 30,
        discoveredWiFi: 40,
        discoveredBt: 50,
        discoveredCell: 60,
        totalWiFiLocations: 100,
        first: '2026-01-01',
        last: '2026-05-28',
        eventMonthCount: 5,
        imageBadgeUrl: '/badge.png',
      },
    };
    wigleGatewayFetch.mockResolvedValue({
      ok: true,
      response: mockResponse(true, mockRaw),
    });
    const result = await getUserStats();
    expect(result).toEqual({
      user: 'testuser',
      rank: 123,
      imageBadgeUrl: '/badge.png',
      discoveredWiFiGPS: 10,
      discoveredBtGPS: 20,
      discoveredCellGPS: 30,
      discoveredWiFi: 40,
      discoveredBt: 50,
      discoveredCell: 60,
      totalWiFiLocations: 100,
      first: '2026-01-01',
      last: '2026-05-28',
      eventMonthCount: 5,
    });
  });

  test('throws when gateway returns ok:false', async () => {
    mockGet.mockReturnValue('value');
    wigleGatewayFetch.mockResolvedValue({ ok: false, error: 'Network timeout', status: undefined });
    await expect(getUserStats()).rejects.toThrow('Network timeout');
  });

  test('preserves HTTP status when gateway returns ok:false (e.g. soft limit 429)', async () => {
    mockGet.mockReturnValue('value');
    wigleGatewayFetch.mockResolvedValue({
      ok: false,
      error: 'WiGLE stats soft limit reached (10/10).',
      status: 429,
    });
    try {
      await getUserStats();
      throw new Error('expected getUserStats to throw');
    } catch (e: any) {
      if (e.message === 'expected getUserStats to throw') {
        throw e;
      }
      expect(e.message).toContain('soft limit');
      expect(e.status).toBe(429);
    }
  });

  test('throws with API error message on non-ok HTTP response', async () => {
    mockGet.mockReturnValue('value');
    wigleGatewayFetch.mockResolvedValue({
      ok: true,
      response: mockResponse(false, { message: 'Forbidden' }, 403),
    });
    try {
      await getUserStats();
      throw new Error('expected throw');
    } catch (e: any) {
      if (e.message === 'expected throw') {
        throw e;
      }
      expect(e.message).toBe('Forbidden');
      expect(e.status).toBe(403);
    }
  });

  test('propagates WiGLE 401 on upstream auth failure (ledger already recorded in gateway)', async () => {
    mockGet.mockReturnValue('value');
    wigleGatewayFetch.mockResolvedValue({
      ok: true,
      response: mockResponse(false, { message: 'Not Authorized (WiGLE.net)' }, 401),
    });
    try {
      await getUserStats();
      throw new Error('expected throw');
    } catch (e: any) {
      if (e.message === 'expected throw') {
        throw e;
      }
      expect(e.message).toContain('Not Authorized');
      expect(e.status).toBe(401);
    }
  });

  test('throws with status code when error body has no message', async () => {
    mockGet.mockReturnValue('value');
    wigleGatewayFetch.mockResolvedValue({
      ok: true,
      response: { ok: false, status: 500, json: () => Promise.reject(new Error('bad json')) },
    });
    try {
      await getUserStats();
      throw new Error('expected throw');
    } catch (e: any) {
      if (e.message === 'expected throw') {
        throw e;
      }
      expect(e.message).toBe('WiGLE API error: 500');
      expect(e.status).toBe(500);
    }
  });

  test('sends Basic auth header with base64-encoded credentials', async () => {
    mockGet.mockReturnValueOnce('testname').mockReturnValueOnce('testtoken');
    wigleGatewayFetch.mockResolvedValue({ ok: true, response: mockResponse(true, {}) });
    await getUserStats();
    const callArgs = wigleGatewayFetch.mock.calls[0][0];
    const expected = Buffer.from('testname:testtoken').toString('base64');
    expect(callArgs.init.headers.Authorization).toBe(`Basic ${expected}`);
  });
});
