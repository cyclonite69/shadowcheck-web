export {};

jest.mock('../../../server/src/config/database', () => ({
  query: jest.fn(),
}));

jest.mock('../../../server/src/services/wigleClient', () => ({
  fetchWigle: jest.fn(),
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
const { fetchWigle } = require('../../../server/src/services/wigleClient');
const secretsManagerModule = require('../../../server/src/services/secretsManager');
const mockGet: jest.Mock = secretsManagerModule.default.get;

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

  test('returns parsed JSON on success', async () => {
    mockGet.mockReturnValue('value');
    fetchWigle.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, statistics: {} }),
    });
    const result = await getUserStats();
    expect(result).toEqual({ success: true, statistics: {} });
  });

  test('throws with API error message on non-ok response', async () => {
    mockGet.mockReturnValue('value');
    fetchWigle.mockResolvedValue({
      ok: false,
      status: 403,
      json: () => Promise.resolve({ message: 'Forbidden' }),
    });
    await expect(getUserStats()).rejects.toThrow('Forbidden');
  });

  test('throws with status code when error body has no message', async () => {
    mockGet.mockReturnValue('value');
    fetchWigle.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error('bad json')),
    });
    await expect(getUserStats()).rejects.toThrow('WiGLE API error: 500');
  });

  test('sends Basic auth header with base64-encoded credentials', async () => {
    mockGet.mockReturnValueOnce('testname').mockReturnValueOnce('testtoken');
    fetchWigle.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
    await getUserStats();
    const callArgs = fetchWigle.mock.calls[0][0];
    const expected = Buffer.from('testname:testtoken').toString('base64');
    expect(callArgs.init.headers.Authorization).toBe(`Basic ${expected}`);
  });
});
