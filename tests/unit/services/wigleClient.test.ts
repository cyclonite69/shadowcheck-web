import { fetchWigle, resetState } from '../../../server/src/services/wigleClient';
import {
  resetQuotaLedger,
  recordConsecutive429,
} from '../../../server/src/services/wigleRequestLedger';

jest.mock('../../../server/src/logging/logger');
// Mock the admin DB writes used by recordRequest so unit tests avoid real I/O but still
// exercise the recordRequest logic via a controlled double.
jest.mock('../../../server/src/services/adminDbService', () => ({
  adminQuery: jest.fn().mockResolvedValue({ rows: [{ id: 1 }] }),
}));

// Flushes the microtask queue and any fake timers deeply enough for a multi-hop
// promise chain (queue slot → resolve/reject → .finally → next slot → work).
// Each await Promise.resolve() advances exactly one microtask tick; 30 rounds
// is conservative for the 8–10 ticks a two-request chain requires.
async function flushQueue() {
  for (let i = 0; i < 30; i++) {
    await Promise.resolve();
  }
  await jest.runAllTimersAsync();
  for (let i = 0; i < 30; i++) {
    await Promise.resolve();
  }
}

function makeResponse(
  body: any,
  ok: boolean,
  status: number,
  headers?: Record<string, string>
): any {
  const headerBag = new Headers(headers || {});
  const response: any = {
    ok,
    status,
    headers: headerBag,
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  };
  response.clone = () => response;
  return response;
}

describe('wigleClient (Deterministic Hardening)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    resetQuotaLedger(); // also resets circuit breaker since the fix
    resetState();
    global.fetch = jest.fn().mockResolvedValue(makeResponse({}, true, 200));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ── Deduplication ──────────────────────────────────────────────────────────

  it('deduplicates concurrent identical requests', async () => {
    const p1 = fetchWigle({ kind: 'search', url: 'http://test', init: { body: 'data' } });
    const p2 = fetchWigle({ kind: 'search', url: 'http://test', init: { body: 'data' } });

    await Promise.all([p1, p2]);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('preserves the real Authorization header on outbound requests', async () => {
    await fetchWigle({
      kind: 'stats',
      url: 'http://test',
      init: { headers: { Authorization: 'Basic real-token', Accept: 'application/json' } },
      maxRetries: 0,
      priority: 'interactive',
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'http://test',
      expect.objectContaining({
        headers: expect.anything(),
      })
    );
    const fetchInit = (global.fetch as jest.Mock).mock.calls[0][1];
    expect(new Headers(fetchInit.headers).get('Authorization')).toBe('Basic real-token');
  });

  it('does not deduplicate requests with different bodies', async () => {
    const p1 = fetchWigle({ kind: 'search', url: 'http://test', init: { body: 'query1' } });
    const p2 = fetchWigle({ kind: 'search', url: 'http://test', init: { body: 'query2' } });

    await Promise.all([p1, p2]);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  // ── Queue serialization ────────────────────────────────────────────────────

  it('serializes requests using the promise queue', async () => {
    const callOrder: string[] = [];
    (global.fetch as jest.Mock).mockImplementation(async (url: string) => {
      callOrder.push(url);
      return makeResponse({}, true, 200);
    });

    await fetchWigle({ kind: 'search', url: 'http://1' });
    await fetchWigle({ kind: 'search', url: 'http://2' });

    expect(callOrder).toEqual(['http://1', 'http://2']);
  });

  // ── Queue resilience after failures ───────────────────────────────────────

  it('resumes queue after a request rejection', async () => {
    (global.fetch as jest.Mock)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(makeResponse({}, true, 200));

    // maxRetries: 0 so p1 exhausts immediately with no backoff
    const p1 = fetchWigle({ kind: 'search', url: 'http://first', maxRetries: 0 });
    const p2 = fetchWigle({ kind: 'search', url: 'http://second' });

    // Await p1 to reject — at this point p2's queue slot has been queued but
    // may not have executed yet. Explicitly awaiting p2 is the only
    // deterministic way to assert its call happened.
    await expect(p1).rejects.toThrow('Network error');
    const result = await p2;

    expect(result.response.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('queue continues after multiple consecutive failures', async () => {
    (global.fetch as jest.Mock)
      .mockRejectedValueOnce(new Error('Failure 1'))
      .mockRejectedValueOnce(new Error('Failure 2'))
      .mockResolvedValueOnce(makeResponse({}, true, 200));

    const p1 = fetchWigle({ kind: 'search', url: 'http://1', maxRetries: 0 });
    const p2 = fetchWigle({ kind: 'search', url: 'http://2', maxRetries: 0 });
    const p3 = fetchWigle({ kind: 'search', url: 'http://3' });

    await expect(p1).rejects.toThrow('Failure 1');
    await expect(p2).rejects.toThrow('Failure 2');
    const r3 = await p3;

    expect(r3.response.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('no request starvation under mixed priority load', async () => {
    // All 4 requests must complete — none can be permanently blocked
    const requests = [
      fetchWigle({ kind: 'search', url: 'http://1', priority: 'background' }),
      fetchWigle({ kind: 'search', url: 'http://2', priority: 'interactive' }),
      fetchWigle({ kind: 'search', url: 'http://3', priority: 'background' }),
      fetchWigle({ kind: 'search', url: 'http://4', priority: 'interactive' }),
    ];

    await Promise.all(requests);
    expect(global.fetch).toHaveBeenCalledTimes(4);
  });

  // ── Circuit breaker ────────────────────────────────────────────────────────

  it('circuit breaker blocks background but allows interactive when open', async () => {
    // Open the real circuit breaker (5 consecutive 429s)
    for (let i = 0; i < 5; i++) {
      recordConsecutive429();
    }

    const bg = fetchWigle({ kind: 'search', url: 'http://bg', priority: 'background' });
    await expect(bg).rejects.toThrow('circuit breaker');

    // Interactive is never blocked by the breaker
    const int = await fetchWigle({ kind: 'search', url: 'http://int', priority: 'interactive' });
    expect(int.response.status).toBe(200);
  });

  it('background requests get a delay when breaker is open (delay logic aligns with rejection)', async () => {
    jest
      .spyOn(require('../../../server/src/services/wigleRequestLedger'), 'getCircuitBreakerStatus')
      .mockReturnValue({ isOpen: true });

    const p1 = fetchWigle({ kind: 'stats', url: 'http://bg', priority: 'background' });
    const p2 = fetchWigle({ kind: 'search', url: 'http://int', priority: 'interactive' });

    await flushQueue();
    await Promise.all([p1, p2]);

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  // ── Retry / backoff ────────────────────────────────────────────────────────

  it('retries on 429 and respects Retry-After header', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(
        makeResponse({ message: 'rate limited' }, false, 429, { 'Retry-After': '5' })
      )
      .mockResolvedValueOnce(makeResponse({}, true, 200));

    const promise = fetchWigle({ kind: 'search', url: 'http://test', maxRetries: 1 });

    await flushQueue();
    const result = await promise;

    expect(result.response.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  // ── Branch Coverage Enhancements ──────────────────────────────────────────

  it('covers sleep and jitter when not in test env', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const p1 = fetchWigle({ kind: 'search', url: 'http://test', maxRetries: 0 });

    // Advance timers enough to pass the sleep(jitter(150, 300))
    await jest.advanceTimersByTimeAsync(400);

    const result = await p1;
    expect(result.response.status).toBe(200);

    process.env.NODE_ENV = originalEnv;
  });

  it('handles invalid URLs gracefully during param extraction and logging', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Invalid URL in fetch'));

    await expect(
      fetchWigle({
        kind: 'search',
        url: 'not-a-valid-url',
        maxRetries: 0,
      })
    ).rejects.toThrow('Invalid URL in fetch');
  });

  it('handles non-string request bodies for deduplication hash', async () => {
    const p1 = fetchWigle({
      kind: 'search',
      url: 'http://test',
      init: { body: { key: 'value' } as any },
    });
    const p2 = fetchWigle({
      kind: 'search',
      url: 'http://test',
      init: { body: { key: 'value' } as any },
    });

    await Promise.all([p1, p2]);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('handles response.text() failure when response is not ok', async () => {
    const badResponse = makeResponse({}, false, 500);
    badResponse.text = jest.fn().mockRejectedValue(new Error('Text parsing failed'));

    (global.fetch as jest.Mock).mockResolvedValueOnce(badResponse);

    const promise = fetchWigle({ kind: 'search', url: 'http://test', maxRetries: 0 });
    await flushQueue();
    const result = await promise;

    expect(result.response.status).toBe(500);
  });
});
