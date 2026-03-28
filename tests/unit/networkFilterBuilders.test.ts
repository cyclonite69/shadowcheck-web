export {};

import {
  applyLocationFilters,
  applySecurityAndRadioFilters,
  applyTextAndRangeFilters,
} from '../../server/src/services/networking/filterBuilders';
import { createNetworkQueryState } from '../../server/src/services/networking/queryState';

describe('network filter builders', () => {
  it('adds text and range filters with applied-filter metadata', () => {
    const state = createNetworkQueryState([], []);

    applyTextAndRangeFilters(
      state,
      {
        ssidPattern: 'Home',
        bssidList: ['AA'],
        threatLevel: 'HIGH',
        threatCategories: ['HIGH', 'CRITICAL'],
        threatScoreMin: 10,
        threatScoreMax: 90,
        lastSeen: '2026-01-01',
        distanceFromHomeKm: null,
        distanceFromHomeMinKm: 1,
        distanceFromHomeMaxKm: 5,
        minSignal: -80,
        maxSignal: -20,
        minObsCount: 2,
        maxObsCount: 50,
        manufacturer: 'Cisco',
        quickSearchPattern: 'Guest',
      },
      {
        threatLevelExpr: 'level_expr',
        threatScoreExpr: 'score_expr',
        distanceExpr: 'distance_expr',
      }
    );

    expect(state.conditions[0]).toContain('ne.ssid ILIKE $1');
    expect(state.conditions).toContain('ne.bssid = ANY($2::text[])');
    expect(state.conditions).toContain('(level_expr) = $3');
    expect(state.conditions).toContain('(level_expr) = ANY($4::text[])');
    expect(state.conditions).toContain('score_expr >= $5');
    expect(state.conditions).toContain('score_expr <= $6');
    expect(state.conditions).toContain('ne.last_seen >= $7');
    expect(state.conditions).toContain('(distance_expr) >= $8');
    expect(state.conditions).toContain('(distance_expr) <= $9');
    expect(state.conditions).toContain('ne.signal >= $10');
    expect(state.conditions).toContain('ne.signal <= $11');
    expect(state.conditions).toContain('ne.observations >= $12');
    expect(state.conditions).toContain('ne.observations <= $13');
    expect(state.conditions[13]).toContain('ne.ssid ILIKE $14 OR ne.bssid ILIKE $14');
    expect(state.conditions).toContain('ne.manufacturer ILIKE $15');
    expect(state.params).toEqual([
      '%Home%',
      ['AA'],
      'HIGH',
      ['HIGH', 'CRITICAL'],
      10,
      90,
      '2026-01-01',
      1,
      5,
      -80,
      -20,
      2,
      50,
      '%Guest%',
      '%Cisco%',
    ]);
    expect(state.paramIndex).toBe(16);
    expect(state.appliedFilters.map((entry) => entry.column)).toEqual([
      'ssid',
      'bssid',
      'threatLevel',
      'threatCategories',
      'threatScore',
      'lastSeen',
      'distanceFromHome',
      'rssi',
      'obsCount',
      'manufacturer',
    ]);
  });

  it('adds radio and security filters with array params and applied metadata', () => {
    const state = createNetworkQueryState([], []);

    applySecurityAndRadioFilters(
      state,
      {
        radioTypes: ['WIFI'],
        encryptionTypes: ['WPA2'],
        authMethods: ['PSK'],
        insecureFlags: ['open'],
        securityFlags: ['enterprise'],
      },
      {
        typeExpr: 'type_expr',
      }
    );

    expect(state.conditions[0]).toContain('(type_expr) = ANY($1::text[])');
    expect(
      state.conditions.some(
        (condition) => condition.includes('security') || condition.includes('capabilities')
      )
    ).toBe(true);
    expect(state.conditions.some((condition) => condition.includes('ne.auth ILIKE'))).toBe(true);
    expect(state.conditions.some((condition) => condition.includes('ne.insecure_flags &&'))).toBe(
      true
    );
    expect(state.conditions.some((condition) => condition.includes('ne.security_flags &&'))).toBe(
      true
    );
    expect(state.paramIndex).toBeGreaterThanOrEqual(6);
    expect(state.appliedFilters.map((entry) => entry.column)).toEqual([
      'radioTypes',
      'encryptionTypes',
      'authMethods',
      'insecureFlags',
      'securityFlags',
    ]);
  });

  it('adds location joins and bounds for non-latest modes', () => {
    const state = createNetworkQueryState([], []);

    applyLocationFilters(state, {
      locationMode: 'centroid',
      bboxMinLat: 1,
      bboxMaxLat: 2,
      bboxMinLng: 3,
      bboxMaxLng: 4,
      radiusCenterLat: 5,
      radiusCenterLng: 6,
      radiusMeters: 7,
    });

    expect(state.joins[0]).toContain('LEFT JOIN LATERAL');
    expect(state.joins[1]).toContain('LEFT JOIN app.network_locations nl');
    expect(state.conditions[0]).toContain('nl.lat BETWEEN $1 AND $2');
    expect(state.conditions[1]).toContain('nl.lon BETWEEN $3 AND $4');
    expect(state.conditions[2]).toContain('ST_Distance');
    expect(state.params).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(state.paramIndex).toBe(8);
  });
});
