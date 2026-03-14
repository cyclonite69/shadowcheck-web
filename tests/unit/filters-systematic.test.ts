import { UniversalFilterQueryBuilder } from '../../server/src/services/filterQueryBuilder/universalFilterQueryBuilder';

describe('Systematic Filter Testing - Global Parity (Every Filter)', () => {
  const testParity = (filters: any, enabled: any, context?: any) => {
    const builder = new UniversalFilterQueryBuilder(filters, enabled, context);
    const list = builder.buildNetworkListQuery();
    const count = builder.buildNetworkCountQuery();
    const dash = builder.buildDashboardMetricsQuery();

    return { list, count, dash };
  };

  const expectParity = (list: any, count: any, dash: any, matchers: any[]) => {
    matchers.forEach((matcher) => {
      if (typeof matcher === 'string') {
        expect(list.sql).toContain(matcher);
        expect(count.sql).toContain(matcher);
        expect(dash.sql).toContain(matcher);
      } else if (matcher instanceof RegExp) {
        expect(list.sql).toMatch(matcher);
        expect(count.sql).toMatch(matcher);
        expect(dash.sql).toMatch(matcher);
      }
    });

    if (list.params.length === 0 && count.params.length === 0 && dash.params.length === 0) return;

    // Parameter parity check:
    // We verify that every parameter used in count/dash is also present in list.
    // List queries often have EXTRA parameters for LIMIT/OFFSET (100, 0) and home point (null).
    try {
      count.params
        .filter((p: any) => p !== null)
        .forEach((p: any) => expect(list.params).toContainEqual(p));
      dash.params
        .filter((p: any) => p !== null)
        .forEach((p: any) => expect(list.params).toContainEqual(p));
    } catch (e) {
      console.log(`Parity failure for parameters:`);
      console.log(`List:`, JSON.stringify(list.params));
      console.log(`Count:`, JSON.stringify(count.params));
      console.log(`Dash:`, JSON.stringify(dash.params));
      throw e;
    }
  };

  const filterConfigs = [
    { key: 'ssid', val: 'guest', match: [/ssid ILIKE/i] },
    { key: 'bssid', val: 'AA:BB:CC:DD:EE:FF', match: [/UPPER\(.*bssid\) =/i] },
    { key: 'manufacturer', val: 'Apple', match: [/manufacturer ILIKE/i] },
    { key: 'radioTypes', val: ['W'], match: [/type = ANY/i] },
    { key: 'frequencyBands', val: ['2.4GHz'], match: ['2412 AND 2484'] },
    { key: 'channelMin', val: 1, match: ['>='] },
    { key: 'channelMax', val: 11, match: ['<='] },
    { key: 'rssiMin', val: -70, match: [/signal >=/i] },
    { key: 'rssiMax', val: -30, match: [/signal <=/i] },
    { key: 'encryptionTypes', val: ['WPA2'], match: ["IN ('WPA2', 'WPA2-P', 'WPA2-E')"] },
    { key: 'securityFlags', val: ['insecure'], match: ["IN ('OPEN', 'WEP', 'WPS')"] },
    {
      key: 'timeframe',
      val: { type: 'relative', relativeWindow: '24h' },
      match: [/time >= NOW\(\) -/i],
    },
    { key: 'temporalScope', val: 'observation_time', match: [] }, // Tested via timeframe logic
    { key: 'observationCountMin', val: 5, match: [/observations >=/i] },
    { key: 'observationCountMax', val: 100, match: [/observations <=/i] },
    { key: 'has_notes', val: true, match: [/EXISTS \(SELECT 1 FROM app.network_notes/i] },
    { key: 'tag_type', val: ['threat'], match: [/EXISTS \(SELECT 1 FROM app.network_tags/i] },
    {
      key: 'wigle_v3_observation_count_min',
      val: 10,
      match: [/wigle_v3_observation_count >=/i],
      ctx: { pageType: 'wigle' },
    },
    { key: 'gpsAccuracyMax', val: 10, match: [/accuracy.* <=/i] },
    {
      key: 'excludeInvalidCoords',
      val: true,
      match: [/lat IS NOT NULL/i, /lat BETWEEN -90 AND 90/i],
    },
    { key: 'distanceFromHomeMin', val: 1, match: [/distance_from_home_km >=/i] },
    { key: 'distanceFromHomeMax', val: 10, match: [/distance_from_home_km <=/i] },
    {
      key: 'boundingBox',
      val: { north: 40.8, south: 40.7, east: -73.9, west: -74.0 },
      match: ['ST_MakeEnvelope'],
    },
    {
      key: 'radiusFilter',
      val: { latitude: 40.7, longitude: -73.9, radiusMeters: 1000 },
      match: ['ST_DWithin'],
    },
    { key: 'threatScoreMin', val: 50, match: [/threat_score >=/i] },
    { key: 'threatScoreMax', val: 90, match: [/threat_score <=/i] },
    { key: 'threatCategories', val: ['critical'], match: [/threat_level = ANY/i] },
    { key: 'stationaryConfidenceMin', val: 0.5, match: [/stationary_confidence >=/i] },
    { key: 'stationaryConfidenceMax', val: 0.9, match: [/stationary_confidence <=/i] },
  ];

  describe('Every Filter Parity Check', () => {
    test.each(filterConfigs)('Parity for filter: $key', ({ key, val, match, ctx }) => {
      const filters = { [key]: val } as any;
      const enabled = { [key]: true } as any;

      if (key === 'temporalScope') {
        filters['timeframe'] = { type: 'relative', relativeWindow: '24h' };
        enabled['timeframe'] = true;
      }

      const { list, count, dash } = testParity(filters, enabled, ctx);

      expectParity(list, count, dash, match);
    });
  });

  describe('Enum-like Iterations (Exhaustive)', () => {
    const encryptions = [
      'OPEN',
      'WEP',
      'WPA',
      'WPA2-P',
      'WPA2-E',
      'WPA2',
      'WPA3-P',
      'WPA3-E',
      'WPA3',
      'OWE',
      'WPS',
      'UNKNOWN',
      'MIXED',
    ];

    test.each(encryptions)('Parity for every encryption iteration: %s', (enc) => {
      const { list, count, dash } = testParity(
        { encryptionTypes: [enc] },
        { encryptionTypes: true }
      );

      const expectedVal =
        enc === 'WPA2'
          ? "IN ('WPA2', 'WPA2-P', 'WPA2-E')"
          : enc === 'WPA3'
            ? "IN ('WPA3', 'WPA3-P', 'WPA3-E', 'OWE')"
            : enc === 'MIXED'
              ? "IN ('WPA', 'WPA2', 'WPA2-P', 'WPA2-E', 'WPA3', 'WPA3-P', 'WPA3-E', 'OWE')"
              : `= '${enc}'`;

      expect(list.sql.replace(/\s+/g, ' ')).toContain(expectedVal);
      expect(count.sql.replace(/\s+/g, ' ')).toContain(expectedVal);
      expect(dash.sql.replace(/\s+/g, ' ')).toContain(expectedVal);
    });
  });

  test('Tag Type: ignore parity', () => {
    const { list, count, dash } = testParity({ tag_type: ['ignore'] }, { tag_type: true });
    const matcher = /is_ignored'\)::boolean, FALSE\) IS TRUE/i;
    expect(list.sql).toMatch(matcher);
    expect(count.sql).toMatch(matcher);
    expect(dash.sql).toMatch(matcher);
  });
});
