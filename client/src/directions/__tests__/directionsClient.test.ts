import { fetchDirections, _resetForTest } from '../directionsClient';

// Mock global fetch
const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

const ORIGIN: [number, number] = [-83.69683, 43.02345];
const DESTINATION: [number, number] = [-83.748, 42.27756];

const TOKEN_RESPONSE = {
  ok: true,
  json: async () => ({ token: 'pk.test_token' }),
};

function makeRouteResponse(distance = 5000, duration = 600) {
  return {
    ok: true,
    json: async () => ({
      routes: [
        {
          geometry: {
            coordinates: [
              [-83.69683, 43.02345],
              [-83.72, 42.8],
              [-83.748, 42.27756],
            ],
          },
          distance,
          duration,
        },
      ],
    }),
  };
}

beforeEach(() => {
  _resetForTest();
  mockFetch.mockReset();
});

describe('directionsClient', () => {
  test('valid route returns polyline + distance + duration', async () => {
    mockFetch
      .mockResolvedValueOnce(TOKEN_RESPONSE)
      .mockResolvedValueOnce(makeRouteResponse(12345, 890));

    const result = await fetchDirections(ORIGIN, DESTINATION);

    expect(result).not.toBeNull();
    expect(result!.coordinates).toHaveLength(3);
    expect(result!.distance_meters).toBe(12345);
    expect(result!.duration_seconds).toBe(890);
  });

  test('returns null when directions API returns no routes', async () => {
    mockFetch.mockResolvedValueOnce(TOKEN_RESPONSE).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ routes: [] }),
    });

    const result = await fetchDirections(ORIGIN, DESTINATION);
    expect(result).toBeNull();
  });

  test('cache returns same data within 5 minutes', async () => {
    mockFetch
      .mockResolvedValueOnce(TOKEN_RESPONSE)
      .mockResolvedValueOnce(makeRouteResponse(5000, 300));

    const first = await fetchDirections(ORIGIN, DESTINATION);
    expect(first).not.toBeNull();

    // Second call — should return cached, no new fetch for directions
    // (rate limiter would block anyway, but cache should hit first)
    _resetForTest(); // Reset rate limiter only conceptually; cache key includes time bucket
    // Since _resetForTest clears cache, let's test differently:
    // Re-fetch to repopulate cache
    mockFetch.mockReset();
    mockFetch
      .mockResolvedValueOnce(TOKEN_RESPONSE)
      .mockResolvedValueOnce(makeRouteResponse(5000, 300));

    const second = await fetchDirections(ORIGIN, DESTINATION);
    expect(second).not.toBeNull();

    // Now call again without resetting — should use cache, no additional fetch
    const callCountBefore = mockFetch.mock.calls.length;
    const third = await fetchDirections(ORIGIN, DESTINATION);
    expect(third).toEqual(second);
    expect(mockFetch.mock.calls.length).toBe(callCountBefore); // no new calls
  });

  test('different modes produce different cache keys', async () => {
    // Driving
    mockFetch
      .mockResolvedValueOnce(TOKEN_RESPONSE)
      .mockResolvedValueOnce(makeRouteResponse(10000, 500));

    const driving = await fetchDirections(ORIGIN, DESTINATION, 'driving');
    expect(driving).not.toBeNull();
    expect(driving!.distance_meters).toBe(10000);

    // Reset rate limiter for walking call
    _resetForTest();

    // Walking — different URL, different cache key
    mockFetch
      .mockResolvedValueOnce(TOKEN_RESPONSE)
      .mockResolvedValueOnce(makeRouteResponse(8000, 1200));

    const walking = await fetchDirections(ORIGIN, DESTINATION, 'walking');
    expect(walking).not.toBeNull();
    expect(walking!.distance_meters).toBe(8000);
    expect(walking!.duration_seconds).toBe(1200);

    // Verify the URL contained the correct profile
    const walkingUrl = mockFetch.mock.calls[3][0] as string;
    expect(walkingUrl).toContain('/walking/');
  });

  test('returns null on API failure', async () => {
    mockFetch
      .mockResolvedValueOnce(TOKEN_RESPONSE)
      .mockResolvedValueOnce({ ok: false, status: 500 });

    const result = await fetchDirections(ORIGIN, DESTINATION);
    expect(result).toBeNull();
  });

  test('returns null when token fetch fails', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });

    const result = await fetchDirections(ORIGIN, DESTINATION);
    expect(result).toBeNull();
  });

  test('rate-limits consecutive calls', async () => {
    mockFetch.mockResolvedValueOnce(TOKEN_RESPONSE).mockResolvedValueOnce(makeRouteResponse());

    // First call succeeds
    await fetchDirections(ORIGIN, DESTINATION, 'driving');

    // Immediately try a DIFFERENT route (different destination to avoid cache hit)
    const OTHER_DEST: [number, number] = [-84.0, 41.0];
    const result = await fetchDirections(ORIGIN, OTHER_DEST, 'driving');
    expect(result).toBeNull(); // rate-limited
  });
});
