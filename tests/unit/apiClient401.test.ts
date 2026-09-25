import { apiClient } from 'client/src/api/client';
import { authController } from '../../client/src/hooks/authController';

describe('ApiClient 401 handling', () => {
  let originalFetch: any;
  let originalLocation: any;

  beforeAll(() => {
    originalFetch = global.fetch;
    originalLocation = (global as any).location;
  });

  beforeEach(() => {
    jest.resetAllMocks();
    authController.markAuthenticated();
    authController.setLogout(async () => Promise.resolve());
    // @ts-ignore ensure window.location exists for tests
    // create writable location object
    // If running in node where window is undefined, attach a minimal global.window
    if (typeof (global as any).window === 'undefined') {
      // @ts-ignore
      (global as any).window = {};
    }
    // @ts-ignore
    delete (window as any).location;
    // @ts-ignore create writable location

    // @ts-ignore
    window.location = { href: '/', assign: jest.fn() } as any;
  });

  afterEach(() => {
    global.fetch = originalFetch as any;
    // restore location
    // @ts-ignore
    if (typeof originalLocation !== 'undefined') {
      // @ts-ignore
      window.location = originalLocation;
    } else {
      // @ts-ignore
      delete (window as any).location;
    }
  });

  test('handles one unauthorized protected request without reloading', async () => {
    const logoutSpy = jest.fn(async () => Promise.resolve());
    authController.setLogout(logoutSpy);

    global.fetch = jest.fn(async () => ({
      status: 401,
      ok: false,
      text: async () => JSON.stringify({ error: 'unauth' }),
      statusText: 'Unauthorized',
    })) as any;

    await expect(apiClient.get('/networks/123')).rejects.toMatchObject({
      message: '401 handled',
      handled: true,
    });
    expect(logoutSpy).toHaveBeenCalledTimes(1);
    expect(window.location.href).toBe('/');
  });

  test('deduplicates simultaneous 401 responses from protected endpoints', async () => {
    const logoutSpy = jest.fn(async () => Promise.resolve());
    authController.setLogout(logoutSpy);

    global.fetch = jest.fn(async () => ({
      status: 401,
      ok: false,
      text: async () => JSON.stringify({ error: 'unauth' }),
      statusText: 'Unauthorized',
    })) as any;

    const results = await Promise.allSettled([
      apiClient.get('/networks/1'),
      apiClient.get('/networks/2'),
      apiClient.get('/networks/3'),
    ]);

    expect(results).toHaveLength(3);
    expect(results.every((result) => result.status === 'rejected')).toBe(true);
    expect(logoutSpy).toHaveBeenCalledTimes(1);
    expect(window.location.href).toBe('/');
  });

  test('lets /auth/me settle normally without logout or navigation', async () => {
    const logoutSpy = jest.fn(async () => Promise.resolve());
    authController.setLogout(logoutSpy);

    global.fetch = jest.fn(async () => ({
      status: 401,
      ok: false,
      text: async () => JSON.stringify({ error: 'not authenticated' }),
      statusText: 'Unauthorized',
    })) as any;

    await expect(apiClient.get('/auth/me')).rejects.toMatchObject({
      message: 'not authenticated',
      status: 401,
    });
    expect(logoutSpy).not.toHaveBeenCalled();
    expect(window.location.href).toBe('/');
  });

  test('does not handle 401 from /auth/login', async () => {
    const logoutSpy = jest.fn(async () => Promise.resolve());
    authController.setLogout(logoutSpy);

    global.fetch = jest.fn(async () => ({
      status: 401,
      ok: false,
      text: async () => JSON.stringify({ error: 'bad creds' }),
      statusText: 'Unauthorized',
    })) as any;

    await expect(apiClient.post('/auth/login', { username: 'a', password: 'b' })).rejects.toThrow();
    expect(logoutSpy).not.toHaveBeenCalled();
  });

  test('does not handle 401 from /auth/logout (no recursion)', async () => {
    const logoutSpy = jest.fn(async () => Promise.resolve());
    authController.setLogout(logoutSpy);

    global.fetch = jest.fn(async () => ({
      status: 401,
      ok: false,
      text: async () => JSON.stringify({ error: 'already logged out' }),
      statusText: 'Unauthorized',
    })) as any;

    await expect(apiClient.post('/auth/logout')).rejects.toThrow();
    expect(logoutSpy).not.toHaveBeenCalled();
  });

  test('successful authentication reset allows a later expired session to be handled', async () => {
    const logoutSpy = jest.fn(async () => Promise.resolve());
    authController.setLogout(logoutSpy);

    global.fetch = jest.fn(async () => ({
      status: 401,
      ok: false,
      text: async () => JSON.stringify({ error: 'unauth' }),
      statusText: 'Unauthorized',
    })) as any;

    await expect(apiClient.get('/networks/1')).rejects.toMatchObject({ handled: true });
    await expect(apiClient.get('/networks/2')).rejects.toMatchObject({ handled: true });
    expect(logoutSpy).toHaveBeenCalledTimes(1);

    authController.markAuthenticated();

    await expect(apiClient.get('/networks/3')).rejects.toMatchObject({ handled: true });
    expect(logoutSpy).toHaveBeenCalledTimes(2);
  });

  test('non-401 errors are re-thrown normally', async () => {
    global.fetch = jest.fn(async () => ({
      status: 500,
      ok: false,
      text: async () => JSON.stringify({ error: 'boom' }),
      statusText: 'Internal Server Error',
    })) as any;

    await expect(apiClient.get('/networks/500')).rejects.toThrow(/Internal Server Error|boom/);
  });
});
