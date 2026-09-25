/**
 * Unit tests for networkListService
 *
 * Verifies OUI normalization, sort-key mapping, optional LIMIT/OFFSET
 * appending, and concurrent count+data querying — without a live DB.
 */

export {};

jest.mock('../../server/src/config/database', () => ({
  query: jest.fn(),
}));

import { listByManufacturer, searchNetworks } from '../../server/src/services/networkListService';

function getQueryMock(): jest.Mock {
  return require('../../server/src/config/database').query as jest.Mock;
}

const FAKE_NETWORK_ROW = {
  unified_id: 1,
  ssid: 'TestNet',
  bssid: 'AABBCC001122',
  type: 'W',
  encryption: 'WPA2',
  signal: -65,
  lasttime: new Date('2025-01-01'),
  latitude: 37.5,
  longitude: -122.1,
  observation_count: '5',
};

beforeEach(() => {
  getQueryMock().mockReset();
});

// ── listByManufacturer ────────────────────────────────────────────────────────

describe('listByManufacturer', () => {
  function mockPromiseAll(rows: unknown[], total: string) {
    // Promise.all([data query, count query])
    getQueryMock()
      .mockResolvedValueOnce({ rows })
      .mockResolvedValueOnce({ rows: [{ total }] });
  }

  it('strips colons from the OUI and uses only the first 6 hex chars', async () => {
    mockPromiseAll([FAKE_NETWORK_ROW], '1');
    await listByManufacturer('AA:BB:CC:DD:EE:FF', 10, 0);

    const params: unknown[] = getQueryMock().mock.calls[0][1];
    expect(params[0]).toBe('AABBCC%');
  });

  it('uppercases a lowercase OUI prefix', async () => {
    mockPromiseAll([FAKE_NETWORK_ROW], '1');
    await listByManufacturer('aabbcc', 10, 0);

    const params: unknown[] = getQueryMock().mock.calls[0][1];
    expect(params[0]).toBe('AABBCC%');
  });

  it('truncates an OUI longer than 6 chars (colons stripped)', async () => {
    mockPromiseAll([], '0');
    await listByManufacturer('AABBCCDDEE', 10, 0); // 10 hex chars → truncate to AABBCC

    const params: unknown[] = getQueryMock().mock.calls[0][1];
    expect(params[0]).toBe('AABBCC%');
  });

  it('defaults to n.lasttime DESC when the sort key is unrecognised', async () => {
    mockPromiseAll([], '0');
    await listByManufacturer('AABBCC', 10, 0, 'invalid_key');

    const sql: string = getQueryMock().mock.calls[0][0];
    expect(sql).toContain('n.lasttime DESC');
  });

  it('applies the correct ORDER BY for explicit sort key "ssid"', async () => {
    mockPromiseAll([], '0');
    await listByManufacturer('AABBCC', 10, 0, 'ssid');

    const sql: string = getQueryMock().mock.calls[0][0];
    expect(sql).toContain('n.ssid ASC');
  });

  it('applies the correct ORDER BY for sort key "signal"', async () => {
    mockPromiseAll([], '0');
    await listByManufacturer('AABBCC', 10, 0, 'signal');

    const sql: string = getQueryMock().mock.calls[0][0];
    expect(sql).toContain('n.bestlevel DESC');
  });

  it('omits LIMIT and OFFSET when both are null', async () => {
    mockPromiseAll([FAKE_NETWORK_ROW], '1');
    await listByManufacturer('AABBCC', null, null);

    const sql: string = getQueryMock().mock.calls[0][0];
    expect(sql).not.toMatch(/LIMIT/i);
    expect(sql).not.toMatch(/OFFSET/i);
  });

  it('appends LIMIT and OFFSET when provided', async () => {
    mockPromiseAll([FAKE_NETWORK_ROW], '1');
    await listByManufacturer('AABBCC', 25, 50);

    const sql: string = getQueryMock().mock.calls[0][0];
    expect(sql).toMatch(/LIMIT/i);
    expect(sql).toMatch(/OFFSET/i);

    const params: unknown[] = getQueryMock().mock.calls[0][1];
    expect(params).toContain(25);
    expect(params).toContain(50);
  });

  it('returns rows and the parsed integer total from the count query', async () => {
    mockPromiseAll([FAKE_NETWORK_ROW], '42');
    const result = await listByManufacturer('AABBCC', 10, 0);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toEqual(FAKE_NETWORK_ROW);
    expect(result.total).toBe(42);
  });

  it('returns total 0 when the count query row is missing', async () => {
    getQueryMock()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{}] }); // total key absent

    const result = await listByManufacturer('AABBCC', 10, 0);
    expect(result.total).toBe(0);
  });
});

// ── searchNetworks ────────────────────────────────────────────────────────────

describe('searchNetworks', () => {
  function mockPromiseAll(rows: unknown[], total: string) {
    getQueryMock()
      .mockResolvedValueOnce({ rows })
      .mockResolvedValueOnce({ rows: [{ total }] });
  }

  it('passes the search pattern through to the query unchanged', async () => {
    mockPromiseAll([], '0');
    await searchNetworks('%home%', 10, 0);

    const params: unknown[] = getQueryMock().mock.calls[0][1];
    expect(params[0]).toBe('%home%');
  });

  it('omits LIMIT and OFFSET when both are null', async () => {
    mockPromiseAll([], '0');
    await searchNetworks('%test%', null, null);

    const sql: string = getQueryMock().mock.calls[0][0];
    expect(sql).not.toMatch(/LIMIT/i);
    expect(sql).not.toMatch(/OFFSET/i);
  });

  it('appends LIMIT and OFFSET when provided', async () => {
    mockPromiseAll([], '0');
    await searchNetworks('%net%', 50, 100);

    const sql: string = getQueryMock().mock.calls[0][0];
    expect(sql).toMatch(/LIMIT/i);
    expect(sql).toMatch(/OFFSET/i);

    const params: unknown[] = getQueryMock().mock.calls[0][1];
    expect(params).toContain(50);
    expect(params).toContain(100);
  });

  it('returns rows and parsed total from count query', async () => {
    mockPromiseAll([FAKE_NETWORK_ROW], '99');
    const result = await searchNetworks('%test%', 10, 0);

    expect(result.rows).toHaveLength(1);
    expect(result.total).toBe(99);
  });

  it('fires exactly 2 DB queries (data + count) per call', async () => {
    mockPromiseAll([FAKE_NETWORK_ROW], '1');
    await searchNetworks('%anything%', 10, 0);
    expect(getQueryMock()).toHaveBeenCalledTimes(2);
  });
});
