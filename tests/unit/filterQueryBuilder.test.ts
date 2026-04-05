export {};

import {
  UniversalFilterQueryBuilder,
  validateFilterPayload,
} from '../../server/src/services/filterQueryBuilder';
import { buildOrderBy } from '../../server/src/api/routes/v2/filteredHelpers';

describe('UniversalFilterQueryBuilder', () => {
  test('rejects RSSI below noise floor', () => {
    const result = validateFilterPayload({ rssiMin: -120 }, { rssiMin: true });
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test('applies RSSI filters only when enabled', () => {
    const disabledBuilder = new UniversalFilterQueryBuilder({ rssiMin: -80 }, { rssiMin: false });
    const disabledQuery = disabledBuilder.buildNetworkListQuery();
    const hasRssi = disabledQuery.appliedFilters.some(
      (f: { field: string }) => f.field === 'rssiMin'
    );
    expect(hasRssi).toBe(false);

    const enabledBuilder = new UniversalFilterQueryBuilder({ rssiMin: -80 }, { rssiMin: true });
    const enabledQuery = enabledBuilder.buildNetworkListQuery();
    const hasEnabledRssi = enabledQuery.appliedFilters.some(
      (f: { field: string }) => f.field === 'rssiMin'
    );
    expect(hasEnabledRssi).toBe(true);
  });

  test('flags threat window scope fallback warning', () => {
    const builder = new UniversalFilterQueryBuilder(
      {
        timeframe: { type: 'relative', relativeWindow: '7d' },
        temporalScope: 'threat_window',
      },
      { timeframe: true, temporalScope: true }
    );
    const result = builder.buildNetworkListQuery();
    expect(result.warnings.some((w: string) => w.includes('Threat window'))).toBe(true);
  });
});

// ── SQL content / filter application ─────────────────────────────────────────

describe('UniversalFilterQueryBuilder – SQL content', () => {
  test('SSID filter enabled → SQL references ssid column', () => {
    const result = new UniversalFilterQueryBuilder(
      { ssid: 'HomeRouter' },
      { ssid: true }
    ).buildNetworkListQuery();

    expect(result.sql.toLowerCase()).toContain('ssid');
    expect(result.appliedFilters.some((f: { field: string }) => f.field === 'ssid')).toBe(true);
  });

  test('SSID filter disabled → ssid not in appliedFilters', () => {
    const result = new UniversalFilterQueryBuilder(
      { ssid: 'HomeRouter' },
      { ssid: false }
    ).buildNetworkListQuery();

    expect(result.appliedFilters.some((f: { field: string }) => f.field === 'ssid')).toBe(false);
  });

  test('BSSID filter enabled → SQL references bssid', () => {
    const result = new UniversalFilterQueryBuilder(
      { bssid: 'AA:BB:CC:DD:EE:FF' },
      { bssid: true }
    ).buildNetworkListQuery();

    expect(result.sql.toLowerCase()).toContain('bssid');
    expect(result.appliedFilters.some((f: { field: string }) => f.field === 'bssid')).toBe(true);
  });

  test('comma-separated SSIDs generate OR predicates', () => {
    const result = new UniversalFilterQueryBuilder(
      { ssid: 'HomeRouter, GuestNet' },
      { ssid: true }
    ).buildNetworkListQuery();

    expect(result.sql).toContain('OR');
    expect(result.params).toContain('%HomeRouter%');
    expect(result.params).toContain('%GuestNet%');
  });

  test('comma-separated BSSIDs preserve exact and prefix matching', () => {
    const result = new UniversalFilterQueryBuilder(
      { bssid: 'AA:BB:CC:DD:EE:FF, AA:BB:CC' },
      { bssid: true }
    ).buildNetworkListQuery();

    expect(result.sql).toContain('OR');
    expect(result.params).toContain('AA:BB:CC:DD:EE:FF');
    expect(result.params).toContain('AA:BB:CC%');
  });

  test('comma-separated manufacturers support mixed text and OUI matching', () => {
    const result = new UniversalFilterQueryBuilder(
      { manufacturer: 'Sierra Wireless, 28A331' },
      { manufacturer: true }
    ).buildNetworkListQuery();

    expect(result.sql).toContain('OR');
    expect(result.params).toContain('%Sierra Wireless%');
    expect(result.params).toContain('28A331');
  });

  test('encryptionTypes filter with WPA2 → SQL contains RSN or WPA2 predicate', () => {
    const result = new UniversalFilterQueryBuilder(
      { encryptionTypes: ['WPA2'] },
      { encryptionTypes: true }
    ).buildNetworkListQuery();

    expect(result.sql).toMatch(/WPA2|RSN/i);
  });

  test('encryptionTypes filter with OPEN → SQL contains OPEN predicate', () => {
    const result = new UniversalFilterQueryBuilder(
      { encryptionTypes: ['OPEN'] },
      { encryptionTypes: true }
    ).buildNetworkListQuery();

    expect(result.sql).toMatch(/OPEN|IS NULL|!~\*/i);
  });

  test('network-only query for radioTypes does not use obs_latest_any CTE', () => {
    const result = new UniversalFilterQueryBuilder(
      { radioTypes: ['E'] },
      { radioTypes: true }
    ).buildNetworkListQuery();

    expect(result.sql).not.toContain('obs_latest_any');
    expect(result.sql).toContain('FROM app.api_network_explorer_mv ne');
  });

  test('network list query projects geocoded address fields from the explorer MV', () => {
    const result = new UniversalFilterQueryBuilder({}, {}).buildNetworkListQuery();

    expect(result.sql).toContain('ne.geocoded_address');
    expect(result.sql).toContain('ne.geocoded_city');
    expect(result.sql).toContain('ne.geocoded_state');
    expect(result.sql).toContain('AS manufacturer_address');
  });

  test('threatScoreMin filter enabled → value is parameterized and filter is applied', () => {
    const result = new UniversalFilterQueryBuilder(
      { threatScoreMin: 60 },
      { threatScoreMin: true }
    ).buildNetworkListQuery();

    expect(result.appliedFilters.some((f: { field: string }) => f.field === 'threatScoreMin')).toBe(
      true
    );
    // Value is passed as a bound parameter, not embedded inline
    expect(result.params).toContain(60);
  });

  test('threatScoreMax filter enabled → value is parameterized and filter is applied', () => {
    const result = new UniversalFilterQueryBuilder(
      { threatScoreMax: 80 },
      { threatScoreMax: true }
    ).buildNetworkListQuery();

    expect(result.appliedFilters.some((f: { field: string }) => f.field === 'threatScoreMax')).toBe(
      true
    );
    // Value is passed as a bound parameter, not embedded inline
    expect(result.params).toContain(80);
  });

  test('network-only query does not scan observations CTE for radio type filters', () => {
    const result = new UniversalFilterQueryBuilder(
      { radioTypes: ['E'] },
      { radioTypes: true }
    ).buildNetworkListQuery({ orderBy: buildOrderBy('last_seen', 'desc') });

    expect(result.sql).not.toContain('obs_latest_any');
    expect(result.sql).toContain('FROM app.api_network_explorer_mv ne');
  });
  test('network-only-compatible filters → buildNetworkListQuery returns valid SQL', () => {
    // All keys used here are in NETWORK_ONLY_FILTERS, exercising the fast path
    const result = new UniversalFilterQueryBuilder(
      { rssiMin: -75, encryptionTypes: ['WPA2'], ssid: 'test' },
      { rssiMin: true, encryptionTypes: true, ssid: true }
    ).buildNetworkListQuery();

    expect(typeof result.sql).toBe('string');
    expect(result.sql.length).toBeGreaterThan(0);
  });

  test('threatCategories alone uses MV fast path', () => {
    const result = new UniversalFilterQueryBuilder(
      {
        threatCategories: ['high'],
      },
      { threatCategories: true }
    ).buildNetworkListQuery({ limit: 500, offset: 0 });

    expect(result.sql).toContain('FROM app.api_network_explorer_mv ne');
    expect(result.sql).not.toContain('WITH filtered_obs AS');
    expect(result.appliedFilters.some((f: any) => f.field === 'threatCategories')).toBe(true);
  });

  test('tag_type=ignore query includes ignored networks in list results', () => {
    const result = new UniversalFilterQueryBuilder(
      { tag_type: ['ignore'] },
      { tag_type: true }
    ).buildNetworkListQuery();

    expect(result.sql).not.toContain('COALESCE(nt.is_ignored, FALSE) = FALSE');
    expect(result.sql).toContain('is_ignored');
    expect(result.appliedFilters.some((f: any) => f.field === 'tag_type')).toBe(true);
  });

  test('tag_type=ignore query includes ignored networks in count results', () => {
    const result = new UniversalFilterQueryBuilder(
      { tag_type: ['ignore'] },
      { tag_type: true }
    ).buildNetworkCountQuery();

    expect(result.sql).not.toContain('NOT EXISTS (');
    expect(result.sql).toContain('is_ignored');
  });

  test('ssid identity search includes ignored networks in list results', () => {
    const result = new UniversalFilterQueryBuilder(
      { ssid: 'undertaker' },
      { ssid: true }
    ).buildNetworkListQuery();

    expect(result.sql).not.toContain('COALESCE(nt.is_ignored, FALSE) = FALSE');
  });

  test('ssid identity search includes ignored networks in count results', () => {
    const result = new UniversalFilterQueryBuilder(
      { ssid: 'undertaker' },
      { ssid: true }
    ).buildNetworkCountQuery();

    expect(result.sql).not.toContain('NOT EXISTS (');
  });

  test('network count encryptionTypes=WPA2 includes enterprise variant', () => {
    const result = new UniversalFilterQueryBuilder(
      { encryptionTypes: ['WPA2'] },
      { encryptionTypes: true }
    ).buildNetworkCountQuery();

    expect(result.sql).toContain("IN ('WPA2', 'WPA2-P', 'WPA2-E')");
  });

  test('buildGeospatialQuery → returns non-empty SQL with lat/lon references', () => {
    const result = new UniversalFilterQueryBuilder({}, {}).buildGeospatialQuery();

    expect(typeof result.sql).toBe('string');
    expect(result.sql.length).toBeGreaterThan(0);
    // Geospatial queries always include coordinate columns
    expect(result.sql.toLowerCase()).toMatch(/lat|lon/);
  });

  test('boundingBox crossing antimeridian uses split envelopes', () => {
    const result = new UniversalFilterQueryBuilder(
      { boundingBox: { north: 10, south: -10, east: -170, west: 170 } },
      { boundingBox: true }
    ).buildNetworkListQuery();

    expect(result.sql).toContain('ST_MakeEnvelope');
    expect(result.sql).toContain('OR o.geom && ST_MakeEnvelope');
    expect(result.params).toContain(170);
    expect(result.params).toContain(-170);
  });

  test('buildGeospatialQuery threatCategories uses MV threat_level semantics', () => {
    const result = new UniversalFilterQueryBuilder(
      { threatCategories: ['high'] },
      { threatCategories: true }
    ).buildGeospatialQuery();

    expect(result.sql).toContain('ne.threat_level = ANY(');
    expect(result.sql).not.toContain('app.get_threat_score(');
  });

  test('all filters disabled → appliedFilters is empty', () => {
    const result = new UniversalFilterQueryBuilder(
      { rssiMin: -70, ssid: 'any', bssid: 'AA:BB' },
      { rssiMin: false, ssid: false, bssid: false }
    ).buildNetworkListQuery();

    expect(result.appliedFilters).toHaveLength(0);
  });

  test('manufacturer sort uses schema-compatible expression', () => {
    const orderBy = buildOrderBy('manufacturer', 'asc');
    expect(orderBy).toContain('ne.manufacturer ASC NULLS LAST');
    expect(orderBy).toContain('ASC');
  });

  test('security sort uses computed security alias', () => {
    const orderBy = buildOrderBy('security', 'asc');
    expect(orderBy).toContain('security ASC');
  });

  test('multi-column sort preserves requested order', () => {
    const orderBy = buildOrderBy('threat_score,last_seen', 'desc,asc');
    const clauses = orderBy.split(',').map((v) => v.trim());
    expect(clauses[0]).toContain('ne.threat_score DESC');
    expect(clauses[1]).toContain('ne.last_seen ASC');
  });

  test('all_tags sort uses aggregated all_tags field', () => {
    const orderBy = buildOrderBy('all_tags', 'asc');
    expect(orderBy).toContain('ne.tag_type ASC NULLS LAST');
    expect(orderBy).toContain('ASC');
  });

  test('network list SQL uses schema-compatible manufacturer projection', () => {
    const result = new UniversalFilterQueryBuilder({}, {}).buildNetworkListQuery();
    expect(result.sql).toContain("to_jsonb(rm)->>'organization_name'");
    expect(result.sql).toContain('AS manufacturer');
  });

  test('network list SQL computes security from capabilities in no-filter path', () => {
    const result = new UniversalFilterQueryBuilder({}, {}).buildNetworkListQuery();
    expect(result.sql).toContain('COALESCE(ne.capabilities, ne.security)');
    expect(result.sql).toContain('AS security');
  });

  test('network list SQL always selects wigle_v3_observation_count', () => {
    const noFilter = new UniversalFilterQueryBuilder({}, {}).buildNetworkListQuery();
    expect(noFilter.sql).toContain('wigle_v3_observation_count');

    const networkOnly = new UniversalFilterQueryBuilder(
      { ssid: 'TestNet' },
      { ssid: true }
    ).buildNetworkListQuery();
    expect(networkOnly.sql).toContain('wigle_v3_observation_count');

    const obsPath = new UniversalFilterQueryBuilder(
      { boundingBox: { north: 40, south: 39, east: -73, west: -74 } },
      { boundingBox: true }
    ).buildNetworkListQuery();
    expect(obsPath.sql).toContain('wigle_v3_observation_count');
  });

  test('manufacturer filter applies OUI prefix match', () => {
    const result = new UniversalFilterQueryBuilder(
      { manufacturer: 'Apple' },
      { manufacturer: true }
    ).buildNetworkListQuery();
    expect(result.appliedFilters.some((f: any) => f.field === 'manufacturer')).toBe(true);
    expect(result.params.some((p: any) => typeof p === 'string' && p.includes('Apple'))).toBe(true);
  });

  test('date-range timeframe filter applies temporal bounds', () => {
    const startDate = new Date('2024-01-01T00:00:00Z');
    const endDate = new Date('2024-12-31T23:59:59Z');
    const result = new UniversalFilterQueryBuilder(
      {
        temporalScope: 'observation_time',
        timeframe: {
          type: 'date-range',
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
      },
      { timeframe: true, temporalScope: true }
    ).buildNetworkListQuery();
    expect(result.appliedFilters.some((f: any) => f.field === 'timeframe')).toBe(true);
    // Date-range uses BETWEEN in SQL
    expect(result.sql).toContain('BETWEEN');
  });

  test('buildNetworkCountQuery returns count SQL', () => {
    const result = new UniversalFilterQueryBuilder(
      { ssid: 'TestNet' },
      { ssid: true }
    ).buildNetworkCountQuery();
    expect(result.sql).toContain('COUNT(');
    expect(result.sql).toContain('ssid');
  });

  test('count query for threatCategories alone uses MV fast path', () => {
    const result = new UniversalFilterQueryBuilder(
      {
        threatCategories: ['high'],
      },
      { threatCategories: true }
    ).buildNetworkCountQuery();

    expect(result.sql).toContain('FROM app.api_network_explorer_mv ne');
    expect(result.sql).not.toContain('WITH filtered_obs AS');
  });

  test('distanceFromHome filters require home location', () => {
    const result = new UniversalFilterQueryBuilder(
      { distanceFromHomeMin: 1, distanceFromHomeMax: 10 },
      { distanceFromHomeMin: true, distanceFromHomeMax: true }
    ).buildNetworkListQuery();
    expect(result.appliedFilters.some((f: any) => f.field === 'distanceFromHomeMin')).toBe(true);
    expect(result.appliedFilters.some((f: any) => f.field === 'distanceFromHomeMax')).toBe(true);
  });
});
