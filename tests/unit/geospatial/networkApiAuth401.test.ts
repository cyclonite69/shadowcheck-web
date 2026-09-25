/**
 * Regression test: geospatial networkApi methods must propagate session-expiry
 * errors thrown by apiClient (marked .handled=true) instead of silently
 * returning empty data.
 *
 * Bug: Geospatial Explorer did not return to login screen on session timeout
 * because bare catch blocks in getNetworkByBssid, getNetworksByBssids, and
 * getNetworkMedia swallowed the error emitted by apiClient after it called
 * authController.handleUnauthorized().
 */

import { authController } from '../../../client/src/hooks/authController';

// ── Mock the apiClient module so import.meta (Vite-only) is never executed. ──
// The mock mirrors the real ApiClient behaviour for 401 handling.
jest.mock('../../../client/src/api/client', () => {
  // Use the real authController so our spy registration works.

  const { authController: ac } = require('../../../client/src/hooks/authController');

  const makeRequest = async (endpoint: string, _options?: unknown) => {
    const url = `/api${endpoint}`;
    const res: any = await (global as any).fetch(url, {});

    if (res.status === 401) {
      if (await ac.handleUnauthorized(url)) {
        const err: any = new Error('401 handled');
        err.handled = true;
        throw err;
      }
    }

    const text = await res.text();
    let data: any = null;
    try {
      data = JSON.parse(text);
    } catch {
      /* ignore */
    }

    if (!res.ok) {
      const message = (data && (data.error || data.message)) || text || `Error ${res.status}`;
      const err: any = new Error(message);
      err.status = res.status;
      throw err;
    }

    return data ?? text;
  };

  return {
    apiClient: {
      get: (ep: string, opts?: unknown) => makeRequest(ep, opts),
      post: (ep: string, _body?: unknown, opts?: unknown) => makeRequest(ep, opts),
      put: (ep: string, _body?: unknown, opts?: unknown) => makeRequest(ep, opts),
      patch: (ep: string, _body?: unknown, opts?: unknown) => makeRequest(ep, opts),
      delete: (ep: string, opts?: unknown) => makeRequest(ep, opts),
    },
  };
});

// Now import the real networkApi (it will use the mocked apiClient above).
import { networkApi } from '../../../client/src/api/networkApi';

describe('networkApi geospatial methods — session expiry propagation', () => {
  let originalFetch: typeof global.fetch;

  beforeAll(() => {
    originalFetch = global.fetch;
  });

  beforeEach(() => {
    jest.resetAllMocks();
    authController.markAuthenticated();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  /**
   * Helper: make every fetch return a 401 and wire a logout spy so
   * authController.handleUnauthorized() fires as it does in production.
   */
  const setupUnauthorizedFetch = () => {
    const logoutSpy = jest.fn(async () => Promise.resolve());
    authController.setLogout(logoutSpy);

    global.fetch = jest.fn(async () => ({
      status: 401,
      ok: false,
      text: async () => JSON.stringify({ error: 'Session expired' }),
      statusText: 'Unauthorized',
    })) as any;

    return logoutSpy;
  };

  test('getNetworkByBssid re-throws handled auth error on 401', async () => {
    const logoutSpy = setupUnauthorizedFetch();

    await expect(networkApi.getNetworkByBssid('AA:BB:CC:DD:EE:FF')).rejects.toMatchObject({
      handled: true,
    });
    expect(logoutSpy).toHaveBeenCalledTimes(1);
  });

  test('getNetworkByBssid does NOT silently return null on session expiry', async () => {
    setupUnauthorizedFetch();

    const result = await networkApi.getNetworkByBssid('AA:BB:CC:DD:EE:FF').then(
      (val: any) => ({ ok: true, val }),
      (err: unknown) => ({ ok: false, err })
    );
    expect(result.ok).toBe(false);
    expect((result as any).err?.handled).toBe(true);
  });

  test('getNetworksByBssids re-throws handled auth error on 401', async () => {
    const logoutSpy = setupUnauthorizedFetch();

    await expect(networkApi.getNetworksByBssids(['AA:BB:CC:DD:EE:FF'])).rejects.toMatchObject({
      handled: true,
    });
    expect(logoutSpy).toHaveBeenCalledTimes(1);
  });

  test('getNetworksByBssids does NOT silently return empty data on session expiry', async () => {
    setupUnauthorizedFetch();

    const result = await networkApi.getNetworksByBssids(['AA:BB:CC:DD:EE:FF']).then(
      (val: any) => ({ ok: true, val }),
      (err: unknown) => ({ ok: false, err })
    );
    expect(result.ok).toBe(false);
    expect((result as any).err?.handled).toBe(true);
  });

  test('getNetworkMedia re-throws handled auth error on 401', async () => {
    const logoutSpy = setupUnauthorizedFetch();

    await expect(networkApi.getNetworkMedia('AA:BB:CC:DD:EE:FF')).rejects.toMatchObject({
      handled: true,
    });
    expect(logoutSpy).toHaveBeenCalledTimes(1);
  });

  test('getNetworkMedia does NOT silently return empty array on session expiry', async () => {
    setupUnauthorizedFetch();

    const result = await networkApi.getNetworkMedia('AA:BB:CC:DD:EE:FF').then(
      (val: any) => ({ ok: true, val }),
      (err: unknown) => ({ ok: false, err })
    );
    expect(result.ok).toBe(false);
    expect((result as any).err?.handled).toBe(true);
  });

  test('getNetworkByBssid still returns null for genuine non-auth errors', async () => {
    global.fetch = jest.fn(async () => ({
      status: 404,
      ok: false,
      text: async () => JSON.stringify({ error: 'Not found' }),
      statusText: 'Not Found',
    })) as any;

    const result = await networkApi.getNetworkByBssid('AA:BB:CC:DD:EE:FF');
    expect(result).toBeNull();
  });

  test('getNetworksByBssids still returns empty data for genuine non-auth errors', async () => {
    global.fetch = jest.fn(async () => ({
      status: 500,
      ok: false,
      text: async () => JSON.stringify({ error: 'Server error' }),
      statusText: 'Internal Server Error',
    })) as any;

    const result = await networkApi.getNetworksByBssids(['AA:BB:CC:DD:EE:FF']);
    expect(result).toEqual({ data: [], unresolved: {} });
  });

  test('getNetworkMedia still returns empty array for genuine non-auth errors', async () => {
    global.fetch = jest.fn(async () => ({
      status: 500,
      ok: false,
      text: async () => JSON.stringify({ error: 'Server error' }),
      statusText: 'Internal Server Error',
    })) as any;

    const result = await networkApi.getNetworkMedia('AA:BB:CC:DD:EE:FF');
    expect(result).toEqual([]);
  });
});
