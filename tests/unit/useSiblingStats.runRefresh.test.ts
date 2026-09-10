/**
 * Unit tests for useSiblingStats — runRefresh() poll behaviour.
 *
 * Covers:
 *   1. Normal completion — poll returns running:false on first tick, stats refreshed.
 *   2. Poll timeout — POLL_MAX_ATTEMPTS ticks with running:true, refreshError set and
 *      runningSiblings cleared without hanging forever.
 *   3. Status-fetch error swallow — GET /refresh/status throws; poll exits cleanly,
 *      stats are still refreshed, runningSiblings is cleared.
 *
 * Strategy: React.useState is patched before the module is loaded (mirrors
 * useSiblingLinks.test.ts) so we can read and verify state setters without a
 * DOM environment.  apiClient is mocked via the Jest moduleNameMapper alias
 * `client/src/api/client` → tests/__mocks__/apiClient.ts.  Timers are faked
 * with jest.useFakeTimers so the 3-second poll delay resolves without real
 * wall-clock time.
 */

// Force module scope — prevents @types/react global `React` namespace from
// colliding with the `const React = require('react')` below.
export {};

const React = require('react');

// ---------------------------------------------------------------------------
// React hook shims (must be installed BEFORE the module under test is loaded)
// ---------------------------------------------------------------------------

type StateTuple = [any, jest.Mock];
const mockStates: any[] = [];
const mockSetters: jest.Mock[] = [];
let stateIndex = 0;

const mockEffects: Array<{ fn: () => void; deps?: any[] }> = [];

const originalUseState = React.useState;
const originalUseEffect = React.useEffect;
const originalUseCallback = React.useCallback;

React.useState = (initial: any) => {
  const idx = stateIndex++;
  if (mockStates[idx] === undefined) {
    mockStates[idx] = initial;
    mockSetters[idx] = jest.fn((next: any) => {
      mockStates[idx] = typeof next === 'function' ? next(mockStates[idx]) : next;
    });
  }
  return [mockStates[idx], mockSetters[idx]] as StateTuple;
};

React.useEffect = (fn: () => void, deps?: any[]) => {
  mockEffects.push({ fn, deps });
};

// useCallback: just return the function as-is for testing purposes
React.useCallback = (fn: any) => fn;

// ---------------------------------------------------------------------------
// Module-level mocks (registered before dynamic require)
// ---------------------------------------------------------------------------

// apiClient is resolved through the moduleNameMapper alias in jest.config.js:
//   'client/src/api/client' → tests/__mocks__/apiClient.ts
// We still need to mock it here so we can control .get() and .post() responses.
const mockApiClient = {
  get: jest.fn(),
  post: jest.fn(),
  delete: jest.fn(),
};

jest.mock('../../client/src/api/client', () => ({
  apiClient: mockApiClient,
}));

// Also mock via the relative alias the hook itself uses when resolved in Node
jest.mock(
  '../../../api/client',
  () => ({
    apiClient: mockApiClient,
  }),
  { virtual: true }
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resetStateSlots() {
  stateIndex = 0;
  mockStates.length = 0;
  mockSetters.length = 0;
  mockEffects.length = 0;
}

// State slot indices as declared in useSiblingStats (order matters):
//   0 → siblingStats
//   1 → siblingByRule
//   2 → purgingSiblings
//   3 → runningSiblings
//   4 → loadingSiblings
//   5 → refreshError
const SLOT_RUNNING = 3;
const SLOT_REFRESH_ERROR = 5;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useSiblingStats — runRefresh poll behaviour', () => {
  let useSiblingStats: any;

  beforeAll(() => {
    // Load AFTER all mocks are installed
    useSiblingStats =
      require('../../client/src/components/admin/hooks/useSiblingStats').useSiblingStats;
  });

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    resetStateSlots();

    // Default: fetchSiblingStats GET succeeds with an empty-ish response
    mockApiClient.get.mockImplementation(async (path: string) => {
      if (path === '/admin/siblings/stats') {
        return {
          ok: true,
          stats: {
            total_pairs: 0,
            strong_pairs: 0,
            candidate_pairs: 0,
            avg_confidence: '0',
            oldest_computed_at: null,
            newest_computed_at: null,
          },
          byRule: [],
        };
      }
      // Default status: not running
      return { ok: true, status: { running: false } };
    });

    // Default: refresh POST succeeds
    mockApiClient.post.mockResolvedValue({ ok: true, accepted: true });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  afterAll(() => {
    React.useState = originalUseState;
    React.useEffect = originalUseEffect;
    React.useCallback = originalUseCallback;
  });

  // -------------------------------------------------------------------------
  // 1. Normal completion
  // -------------------------------------------------------------------------
  test('clears runningSiblings and refreshes stats when status returns running:false', async () => {
    // status endpoint: first call returns running:false immediately
    mockApiClient.get.mockImplementation(async (path: string) => {
      if (path === '/admin/siblings/stats') {
        return { ok: true, stats: null, byRule: [] };
      }
      return { ok: true, status: { running: false } };
    });

    const hook = useSiblingStats();

    // Invoke runRefresh — it fires POST then launches the poll in the background
    const refreshPromise = hook.runRefresh(false);
    await refreshPromise; // awaits the POST, poll runs freely

    // Advance past one 3-second tick
    await jest.runAllTimersAsync();

    // runningSiblings should have been set to false
    expect(mockSetters[SLOT_RUNNING]).toHaveBeenCalledWith(false);

    // fetchSiblingStats (GET /admin/siblings/stats) should have been called
    const statsCalls = mockApiClient.get.mock.calls.filter(
      ([path]: [string]) => path === '/admin/siblings/stats'
    );
    expect(statsCalls.length).toBeGreaterThanOrEqual(1);

    // refreshError should not have been set to a non-null value
    const errorSetCalls = mockSetters[SLOT_REFRESH_ERROR]?.mock.calls ?? [];
    const nonNullErrors = errorSetCalls.filter(([v]: [any]) => v !== null);
    expect(nonNullErrors).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // 2. Poll timeout — POLL_MAX_ATTEMPTS exhausted
  // -------------------------------------------------------------------------
  test('sets refreshError and clears runningSiblings after POLL_MAX_ATTEMPTS ticks with running:true', async () => {
    // Always return running:true so poll never self-exits
    mockApiClient.get.mockImplementation(async (path: string) => {
      if (path === '/admin/siblings/stats') {
        return { ok: true, stats: null, byRule: [] };
      }
      return { ok: true, status: { running: true } };
    });

    const hook = useSiblingStats();
    const refreshPromise = hook.runRefresh(false);
    await refreshPromise;

    // Run all timers: each attempt waits 3 s, 20 attempts = 60 s total
    await jest.runAllTimersAsync();

    // After exhausting attempts, refreshError must be a non-null string
    const errorSetCalls = (mockSetters[SLOT_REFRESH_ERROR]?.mock.calls ?? []).filter(
      ([v]: [any]) => v !== null
    );
    expect(errorSetCalls.length).toBeGreaterThanOrEqual(1);
    expect(typeof errorSetCalls[0][0]).toBe('string');
    expect(errorSetCalls[0][0]).toMatch(/timed out/i);

    // runningSiblings must have been cleared to false
    expect(mockSetters[SLOT_RUNNING]).toHaveBeenCalledWith(false);
  });

  // -------------------------------------------------------------------------
  // 3. Status-fetch error swallow
  // -------------------------------------------------------------------------
  test('stops polling cleanly when GET /refresh/status throws, still refreshes stats', async () => {
    mockApiClient.get.mockImplementation(async (path: string) => {
      if (path === '/admin/siblings/stats') {
        return { ok: true, stats: null, byRule: [] };
      }
      // Simulate a transient network failure on the status endpoint
      throw new Error('Network error');
    });

    const hook = useSiblingStats();
    const refreshPromise = hook.runRefresh(false);
    await refreshPromise;

    // One timer tick is enough — the catch block exits the poll
    await jest.runAllTimersAsync();

    // runningSiblings cleared
    expect(mockSetters[SLOT_RUNNING]).toHaveBeenCalledWith(false);

    // fetchSiblingStats called after the error-stop
    const statsCalls = mockApiClient.get.mock.calls.filter(
      ([path]: [string]) => path === '/admin/siblings/stats'
    );
    expect(statsCalls.length).toBeGreaterThanOrEqual(1);

    // No timeout error should have been surfaced (it was a swallowed error, not a timeout)
    const errorSetCalls = (mockSetters[SLOT_REFRESH_ERROR]?.mock.calls ?? []).filter(
      ([v]: [any]) => v !== null
    );
    expect(errorSetCalls).toHaveLength(0);
  });
});
