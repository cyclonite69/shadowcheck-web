export {};

import { FilterBuildContext } from '../../server/src/services/filterQueryBuilder/FilterBuildContext';
import { buildObservationIdentityPredicates } from '../../server/src/services/filterQueryBuilder/modules/observationIdentityPredicates';
import { buildObservationSecurityTemporalPredicates } from '../../server/src/services/filterQueryBuilder/modules/observationSecurityTemporalPredicates';
import { buildObservationSpatialQualityPredicates } from '../../server/src/services/filterQueryBuilder/modules/observationSpatialQualityPredicates';

describe('observation filter helper modules', () => {
  test('identity helper tokenizes SSID and adds manufacturer join when needed', () => {
    const ctx = new FilterBuildContext(
      { ssid: 'Home, Guest', manufacturer: 'Cisco' },
      { ssid: true, manufacturer: true }
    );

    const where = buildObservationIdentityPredicates(ctx);

    expect(where[0]).toContain('OR');
    expect(where[1]).toContain('rm.manufacturer ILIKE');
    expect(Array.from(ctx.obsJoins).some((join) => join.includes('radio_manufacturers'))).toBe(
      true
    );
    expect(ctx.getParams()).toEqual(['%Home%', '%Guest%', '%Cisco%']);
  });

  test('security/temporal helper applies encryption, warning, and timeframe params', () => {
    const ctx = new FilterBuildContext(
      {
        encryptionTypes: ['WPA2'],
        timeframe: { type: 'relative', relativeWindow: '7d' },
        temporalScope: 'threat_window',
      },
      { encryptionTypes: true, timeframe: true, temporalScope: true }
    );

    const where = buildObservationSecurityTemporalPredicates(ctx);

    expect(where[0]).toContain("IN ('WPA2', 'WPA2-P', 'WPA2-E')");
    expect(where[1]).toContain('NOW() - $1::interval');
    expect(ctx.state.warnings()).toContain(
      'Threat window scope mapped to observation_time on slow path.'
    );
    expect(ctx.getAppliedFilters().map((entry) => entry.field)).toEqual([
      'encryptionTypes',
      'timeframe',
      'temporalScope',
    ]);
  });

  test('spatial/quality helper adds home requirement when needed', () => {
    const ctx = new FilterBuildContext(
      {
        observationCountMin: 5,
        distanceFromHomeMax: 2,
      },
      { observationCountMin: true, distanceFromHomeMax: true }
    );

    const where = buildObservationSpatialQualityPredicates(ctx);

    // observationCountMin is handled at the network level (networkWhereBuilder),
    // not in the observation predicates. Only distance filter appears here.
    const joined = where.join(' ');
    expect(joined).toContain('home.home_point');
    expect(ctx.requiresHome).toBe(true);
  });
});
