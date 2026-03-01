/**
 * Unit tests for v2Service
 *
 * Tests database query delegation, result mapping, and guard logic
 * without a live database connection.  All DB calls are mocked via
 * jest.mock so these run fully in-process.
 */

export {};

jest.mock('../../server/src/config/database', () => ({
  query: jest.fn(),
  CONFIG: { MAX_PAGE_SIZE: 5000, THREAT_THRESHOLD: 40 },
}));

import {
  executeV2Query,
  listNetworks,
  getNetworkDetail,
  getDashboardMetrics,
  getThreatMapData,
  getThreatSeverityCounts,
  checkHomeExists,
} from '../../server/src/services/v2Service';

// ── Helpers ───────────────────────────────────────────────────────────────────

function getQueryMock(): jest.Mock {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../../server/src/config/database').query as jest.Mock;
}

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    bssid: 'AA:BB:CC:DD:EE:FF',
    ssid: 'TestNet',
    lat: 37.5,
    lon: -122.1,
    latest_signal: -65,
    accuracy: 5,
    latest_time: new Date('2025-01-01T00:00:00Z'),
    frequency: 2412,
    capabilities: '[WPA2]',
    obs_count: '10',
    first_seen: new Date('2024-01-01'),
    last_seen: new Date('2025-01-01'),
    final_threat_score: '0',
    final_threat_level: 'NONE',
    model_version: 'rule-v3.1',
    total: '1',
    ...overrides,
  };
}

beforeEach(() => {
  getQueryMock().mockReset();
});

// ── executeV2Query ────────────────────────────────────────────────────────────

describe('executeV2Query', () => {
  it('delegates SQL and params directly to query()', async () => {
    const mockQuery = getQueryMock();
    const fakeResult = { rows: [{ id: 1 }], rowCount: 1 };
    mockQuery.mockResolvedValueOnce(fakeResult);

    const result = await executeV2Query('SELECT 1 AS id', []);
    expect(mockQuery).toHaveBeenCalledWith('SELECT 1 AS id', []);
    expect(result).toBe(fakeResult);
  });

  it('works without optional params argument', async () => {
    const mockQuery = getQueryMock();
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    await executeV2Query('SELECT NOW()');
    expect(mockQuery).toHaveBeenCalledWith('SELECT NOW()', undefined);
  });
});

// ── listNetworks ──────────────────────────────────────────────────────────────

describe('listNetworks', () => {
  it('omits WHERE clause when search is empty', async () => {
    const mockQuery = getQueryMock();
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await listNetworks({ limit: 10, offset: 0, search: '', sort: 'observed_at', order: 'DESC' });

    const sql: string = mockQuery.mock.calls[0][0];
    expect(sql).not.toMatch(/WHERE/i);
  });

  it('adds ILIKE WHERE clause when search is provided', async () => {
    const mockQuery = getQueryMock();
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await listNetworks({
      limit: 10,
      offset: 0,
      search: 'home',
      sort: 'observed_at',
      order: 'DESC',
    });

    const sql: string = mockQuery.mock.calls[0][0];
    expect(sql).toMatch(/ILIKE/i);
    const params: unknown[] = mockQuery.mock.calls[0][1];
    expect(params).toContain('%home%');
  });

  it('falls back to latest_time when sort key is unrecognised', async () => {
    const mockQuery = getQueryMock();
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await listNetworks({ limit: 10, offset: 0, search: '', sort: 'unknown_key', order: 'ASC' });

    const sql: string = mockQuery.mock.calls[0][0];
    expect(sql).toContain('latest_time');
  });

  it('maps null ssid to (hidden)', async () => {
    const mockQuery = getQueryMock();
    mockQuery.mockResolvedValueOnce({ rows: [makeRow({ ssid: null, total: '1' })] });

    const result = await listNetworks({
      limit: 10,
      offset: 0,
      search: '',
      sort: 'ssid',
      order: 'ASC',
    });
    expect(result.rows[0].ssid).toBe('(hidden)');
  });

  it('defaults threat_level to NONE and model_version to rule-v3.1 when absent', async () => {
    const mockQuery = getQueryMock();
    mockQuery.mockResolvedValueOnce({
      rows: [
        makeRow({
          final_threat_level: null,
          model_version: null,
          final_threat_score: null,
          total: '1',
        }),
      ],
    });

    const result = await listNetworks({
      limit: 10,
      offset: 0,
      search: '',
      sort: 'observed_at',
      order: 'DESC',
    });
    expect(result.rows[0].threat_level).toBe('NONE');
    expect(result.rows[0].model_version).toBe('rule-v3.1');
    expect(result.rows[0].threat_score).toBe(0);
  });

  it('extracts total from rows[0].total and returns 0 when result is empty', async () => {
    const mockQuery = getQueryMock();
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const result = await listNetworks({
      limit: 10,
      offset: 0,
      search: '',
      sort: 'observed_at',
      order: 'DESC',
    });
    expect(result.total).toBe(0);
    expect(result.rows).toHaveLength(0);
  });
});

// ── getNetworkDetail ──────────────────────────────────────────────────────────

describe('getNetworkDetail', () => {
  it('issues exactly 5 DB queries and returns combined result', async () => {
    const mockQuery = getQueryMock();
    const bssid = 'AA:BB:CC:DD:EE:FF';

    // 1: latest (Promise.all[0])
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          bssid,
          ssid: 'Net',
          lat: 37,
          lon: -122,
          signal: -70,
          accuracy: 5,
          observed_at: new Date(),
          frequency: 2412,
          capabilities: '',
          altitude: null,
        },
      ],
    });
    // 2: timeline (Promise.all[1])
    mockQuery.mockResolvedValueOnce({
      rows: [
        { bucket: new Date(), obs_count: '3', avg_signal: -70, min_signal: -80, max_signal: -60 },
      ],
    });
    // 3: threatData (Promise.all[2])
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          bssid,
          final_threat_score: 55,
          final_threat_level: 'HIGH',
          model_version: 'rule-v3.1',
          ml_threat_probability: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ],
    });
    // 4: obsCount
    mockQuery.mockResolvedValueOnce({ rows: [{ count: '12' }] });
    // 5: firstLast
    mockQuery.mockResolvedValueOnce({
      rows: [{ first_seen: new Date('2024-01-01'), last_seen: new Date('2025-01-01') }],
    });

    const detail = await getNetworkDetail(bssid);

    expect(mockQuery).toHaveBeenCalledTimes(5);
    expect(detail.latest).not.toBeNull();
    expect(detail.timeline).toHaveLength(1);
    expect(detail.threat?.final_threat_level).toBe('HIGH');
    expect(detail.observation_count).toBe(12);
    expect(detail.first_seen).toEqual(new Date('2024-01-01'));
  });

  it('returns null for latest and threat when network has no data', async () => {
    const mockQuery = getQueryMock();
    mockQuery.mockResolvedValueOnce({ rows: [] }); // latest
    mockQuery.mockResolvedValueOnce({ rows: [] }); // timeline
    mockQuery.mockResolvedValueOnce({ rows: [] }); // threat
    mockQuery.mockResolvedValueOnce({ rows: [{ count: '0' }] }); // obsCount
    mockQuery.mockResolvedValueOnce({ rows: [{ first_seen: null, last_seen: null }] }); // firstLast

    const detail = await getNetworkDetail('00:00:00:00:00:00');
    expect(detail.latest).toBeNull();
    expect(detail.threat).toBeNull();
    expect(detail.observation_count).toBe(0);
  });
});

// ── getDashboardMetrics ───────────────────────────────────────────────────────

describe('getDashboardMetrics', () => {
  it('maps threat counts and network/observation totals from DB rows', async () => {
    const mockQuery = getQueryMock();
    mockQuery.mockResolvedValueOnce({
      rows: [{ critical: '2', high: '5', medium: '8', low: '15' }],
    });
    mockQuery.mockResolvedValueOnce({
      rows: [{ total_networks: '100', observations: '4200' }],
    });

    const metrics = await getDashboardMetrics();
    expect(metrics.threats.critical).toBe(2);
    expect(metrics.threats.high).toBe(5);
    expect(metrics.threats.medium).toBe(8);
    expect(metrics.threats.low).toBe(15);
    expect(metrics.networks.total).toBe(100);
    expect(metrics.observations).toBe(4200);
  });

  it('returns zeroes for all fields when DB rows are empty', async () => {
    const mockQuery = getQueryMock();
    mockQuery.mockResolvedValueOnce({ rows: [{}] });
    mockQuery.mockResolvedValueOnce({ rows: [{}] });

    const metrics = await getDashboardMetrics();
    expect(metrics.threats.critical).toBe(0);
    expect(metrics.networks.total).toBe(0);
    expect(metrics.observations).toBe(0);
  });
});

// ── getThreatSeverityCounts ───────────────────────────────────────────────────

describe('getThreatSeverityCounts', () => {
  it('always includes is_ignored filter; no category param when threatCategories is disabled', async () => {
    const mockQuery = getQueryMock();
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const counts = await getThreatSeverityCounts({}, { threatCategories: false });

    const sql: string = mockQuery.mock.calls[0][0];
    // is_ignored suppression is unconditional
    expect(sql).toMatch(/is_ignored IS NOT TRUE/i);
    // No category array filter when threatCategories is disabled
    expect(sql).not.toMatch(/= ANY\(\$1\)/i);
    // All buckets default to zero
    expect(counts.critical.unique_networks).toBe(0);
    expect(counts.medium.total_observations).toBe(0);
  });

  it('maps DB "MED" severity to the medium key', async () => {
    const mockQuery = getQueryMock();
    mockQuery.mockResolvedValueOnce({
      rows: [{ severity: 'MED', unique_networks: '7', total_observations: '200' }],
    });

    const counts = await getThreatSeverityCounts({}, {});
    expect(counts.medium.unique_networks).toBe(7);
    expect(counts.medium.total_observations).toBe(200);
    expect(counts.critical.unique_networks).toBe(0);
  });

  it('adds WHERE clause and maps category names when filter is enabled', async () => {
    const mockQuery = getQueryMock();
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await getThreatSeverityCounts(
      { threatCategories: ['critical', 'medium'] },
      { threatCategories: true }
    );

    const params: unknown[] = mockQuery.mock.calls[0][1];
    // 'medium' → 'MED', 'critical' → 'CRITICAL'
    expect(params[0]).toEqual(expect.arrayContaining(['CRITICAL', 'MED']));
  });

  it('applies radioTypes scope when enabled', async () => {
    const mockQuery = getQueryMock();
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await getThreatSeverityCounts({ radioTypes: ['w'] }, { radioTypes: true });

    const sql: string = mockQuery.mock.calls[0][0];
    const params: unknown[] = mockQuery.mock.calls[0][1];
    expect(sql).toMatch(
      /COALESCE\(ne\.radio_type,\s*CASE\s+WHEN ne\.radio_frequency BETWEEN 2412 AND 2484 THEN 'W'/i
    );
    expect(params).toContainEqual(['W']);
  });

  it('uses dynamic parameter indexes when combining threatCategories and radioTypes', async () => {
    const mockQuery = getQueryMock();
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await getThreatSeverityCounts(
      { threatCategories: ['high'], radioTypes: ['W'] },
      { threatCategories: true, radioTypes: true }
    );

    const sql: string = mockQuery.mock.calls[0][0];
    const params: unknown[] = mockQuery.mock.calls[0][1];

    expect(sql).toContain(') = ANY($1)');
    expect(sql).toContain('= ANY($2)');
    expect(params[0]).toEqual(['HIGH']);
    expect(params[1]).toEqual(['W']);
  });
});

// ── checkHomeExists ───────────────────────────────────────────────────────────

describe('checkHomeExists', () => {
  it('returns true when a home location marker exists', async () => {
    const mockQuery = getQueryMock();
    mockQuery.mockResolvedValueOnce({ rowCount: 1, rows: [{}] });
    expect(await checkHomeExists()).toBe(true);
  });

  it('returns false when no home location marker exists', async () => {
    const mockQuery = getQueryMock();
    mockQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });
    expect(await checkHomeExists()).toBe(false);
  });
});
