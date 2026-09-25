export {};

jest.mock('../../../server/src/repositories/exportRepository', () => ({
  queryObservationsForCSV: jest.fn(),
  queryObservationsForJSON: jest.fn(),
  queryNetworksForJSON: jest.fn(),
  queryObservationsForGeoJSON: jest.fn(),
  queryAppTableNames: jest.fn(),
  queryTableRowCount: jest.fn(),
  queryTableRows: jest.fn(),
  queryObservationsForKML: jest.fn(),
}));

const {
  generateKML,
  getObservationsForKML,
  getFullDatabaseSnapshot,
} = require('../../../server/src/services/exportService');

const repo = require('../../../server/src/repositories/exportRepository');

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeObs(overrides: Record<string, unknown> = {}) {
  return {
    bssid: 'AA:BB:CC:DD:EE:FF',
    ssid: 'TestNet',
    lat: 38.9,
    lon: -77.0,
    altitude: null,
    signal_dbm: -65,
    frequency: 2412,
    radio_type: 'W',
    accuracy: 5.5,
    observed_at: '2026-01-01T12:00:00Z',
    ...overrides,
  };
}

// ── generateKML ───────────────────────────────────────────────────────────────

describe('generateKML', () => {
  test('returns empty-document KML for null input', () => {
    const kml = generateKML(null);
    expect(kml).toContain('No Data');
    expect(kml).toContain('<?xml version="1.0"');
  });

  test('returns empty-document KML for empty array', () => {
    const kml = generateKML([]);
    expect(kml).toContain('No Data');
  });

  test('produces valid KML wrapper for single observation', () => {
    const kml = generateKML([makeObs()]);
    expect(kml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(kml).toContain('<kml xmlns="http://www.opengis.net/kml/2.2">');
    expect(kml).toContain('</kml>');
    expect(kml).toContain('<Document>');
  });

  test('groups observations by BSSID into Folders', () => {
    const obs = [
      makeObs({ bssid: 'AA:BB:CC:DD:EE:FF', observed_at: '2026-01-02T00:00:00Z' }),
      makeObs({ bssid: 'AA:BB:CC:DD:EE:FF', observed_at: '2026-01-01T00:00:00Z' }),
      makeObs({ bssid: '11:22:33:44:55:66', ssid: 'OtherNet' }),
    ];
    const kml = generateKML(obs);
    expect((kml.match(/<Folder>/g) || []).length).toBe(2);
    expect(kml).toContain('2 Network(s)');
  });

  test('single BSSID with multiple observations produces multiple Placemarks', () => {
    const obs = [
      makeObs({ observed_at: '2026-01-03T00:00:00Z' }),
      makeObs({ observed_at: '2026-01-02T00:00:00Z' }),
      makeObs({ observed_at: '2026-01-01T00:00:00Z' }),
    ];
    const kml = generateKML(obs);
    expect((kml.match(/<Placemark>/g) || []).length).toBe(3);
  });

  test('includes coordinates in lon,lat order', () => {
    const kml = generateKML([makeObs({ lat: 38.9, lon: -77.0 })]);
    expect(kml).toContain('-77,38.9');
  });

  test('appends altitude when present', () => {
    const kml = generateKML([makeObs({ altitude: 50 })]);
    expect(kml).toContain('-77,38.9,50');
  });

  test('omits altitude suffix when null', () => {
    const kml = generateKML([makeObs({ altitude: null })]);
    // should not have a third coordinate component
    expect(kml).not.toMatch(/-77,38\.9,/);
  });

  test('falls back to (hidden) when ssid is empty string', () => {
    const kml = generateKML([makeObs({ ssid: '' })]);
    expect(kml).toContain('(hidden)');
  });

  test('falls back to bssid in Placemark name when ssid is falsy', () => {
    const kml = generateKML([makeObs({ ssid: null })]);
    expect(kml).toContain('AA:BB:CC:DD:EE:FF');
  });

  // escapeXml is exercised through generateKML (not exported directly)
  test('escapes & in SSID', () => {
    const kml = generateKML([makeObs({ ssid: 'Home & Away' })]);
    expect(kml).toContain('Home &amp; Away');
    expect(kml).not.toContain('Home & Away');
  });

  test('escapes < and > in SSID', () => {
    const kml = generateKML([makeObs({ ssid: '<evil>' })]);
    expect(kml).toContain('&lt;evil&gt;');
  });

  test('escapes double-quote in SSID', () => {
    const kml = generateKML([makeObs({ ssid: 'Say "hello"' })]);
    expect(kml).toContain('Say &quot;hello&quot;');
  });

  test('escapes single-quote in SSID', () => {
    const kml = generateKML([makeObs({ ssid: "O'Brien" })]);
    expect(kml).toContain('O&apos;Brien');
  });

  test('escapes all five XML special chars in one SSID', () => {
    const kml = generateKML([makeObs({ ssid: '<a b="c" d=\'e\'>&</a>' })]);
    expect(kml).toContain('&lt;a b=&quot;c&quot; d=&apos;e&apos;&gt;&amp;&lt;/a&gt;');
  });

  test('handles null/undefined ssid without throwing', () => {
    expect(() => generateKML([makeObs({ ssid: undefined })])).not.toThrow();
    expect(() => generateKML([makeObs({ ssid: null })])).not.toThrow();
  });

  test('accuracy formatted to 2 decimal places in secondary Placemarks', () => {
    const obs = [
      makeObs({ observed_at: '2026-01-02T00:00:00Z', accuracy: 3.14159 }),
      makeObs({ observed_at: '2026-01-01T00:00:00Z', accuracy: 3.14159 }),
    ];
    const kml = generateKML(obs);
    expect(kml).toContain('3.14m');
  });

  test('shows N/A when accuracy is null in secondary Placemarks', () => {
    const obs = [
      makeObs({ observed_at: '2026-01-02T00:00:00Z', accuracy: null }),
      makeObs({ observed_at: '2026-01-01T00:00:00Z', accuracy: null }),
    ];
    const kml = generateKML(obs);
    expect(kml).toContain('N/A');
  });
});

// ── getObservationsForKML ─────────────────────────────────────────────────────

describe('getObservationsForKML', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns empty array for empty bssids', async () => {
    const result = await getObservationsForKML([]);
    expect(repo.queryObservationsForKML).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  test('returns empty array for null bssids', async () => {
    const result = await getObservationsForKML(null);
    expect(result).toEqual([]);
  });

  test('delegates to repository with provided bssids', async () => {
    repo.queryObservationsForKML.mockResolvedValue([makeObs()]);
    const result = await getObservationsForKML(['AA:BB:CC:DD:EE:FF']);
    expect(repo.queryObservationsForKML).toHaveBeenCalledWith(['AA:BB:CC:DD:EE:FF']);
    expect(result).toHaveLength(1);
  });
});

// ── getFullDatabaseSnapshot budget logic ──────────────────────────────────────

describe('getFullDatabaseSnapshot', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.FULL_EXPORT_MAX_ROWS_PER_TABLE;
    delete process.env.FULL_EXPORT_MAX_ROWS_TOTAL;
  });

  test('marks snapshot truncated when a table has more rows than exported', async () => {
    repo.queryAppTableNames.mockResolvedValue(['networks']);
    repo.queryTableRowCount.mockResolvedValue(500);
    repo.queryTableRows.mockResolvedValue(new Array(100).fill({})); // fewer than rowCount

    const result = await getFullDatabaseSnapshot();
    expect(result.truncated).toBe(true);
    expect(result.tables['networks'].truncated).toBe(true);
  });

  test('marks snapshot not truncated when all rows fit', async () => {
    repo.queryAppTableNames.mockResolvedValue(['networks']);
    repo.queryTableRowCount.mockResolvedValue(3);
    repo.queryTableRows.mockResolvedValue([{}, {}, {}]);

    const result = await getFullDatabaseSnapshot();
    expect(result.truncated).toBe(false);
    expect(result.tables['networks'].truncated).toBe(false);
  });

  test('respects maxRowsTotal budget across tables', async () => {
    process.env.FULL_EXPORT_MAX_ROWS_PER_TABLE = '10000';
    process.env.FULL_EXPORT_MAX_ROWS_TOTAL = '5';

    repo.queryAppTableNames.mockResolvedValue(['t1', 't2']);
    repo.queryTableRowCount.mockResolvedValue(10);
    // t1 gets 5 rows (exhausts budget), t2 gets 0
    repo.queryTableRows.mockResolvedValueOnce(new Array(5).fill({})).mockResolvedValueOnce([]);

    const result = await getFullDatabaseSnapshot();
    // Second call to queryTableRows should have been called with limit=0
    expect(repo.queryTableRows).toHaveBeenNthCalledWith(2, 't2', 0);
    expect(result.truncated).toBe(true);
  });

  test('includes schema, exported_at, and limits in output', async () => {
    repo.queryAppTableNames.mockResolvedValue([]);
    const result = await getFullDatabaseSnapshot();
    expect(result.schema).toBe('app');
    expect(result.exported_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(result.limits).toHaveProperty('maxRowsPerTable');
    expect(result.limits).toHaveProperty('maxRowsTotal');
  });
});
