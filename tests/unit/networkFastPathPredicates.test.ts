export {};

import { FilterBuildContext } from '../../server/src/services/filterQueryBuilder/FilterBuildContext';
import { buildFastPathIdentityPredicates } from '../../server/src/services/filterQueryBuilder/modules/networkFastPathIdentityPredicates';
import { buildFastPathSecurityPredicates } from '../../server/src/services/filterQueryBuilder/modules/networkFastPathSecurityPredicates';
import { buildFastPathSupplementalPredicates } from '../../server/src/services/filterQueryBuilder/modules/networkFastPathSupplementalPredicates';

describe('network fast-path predicate helpers', () => {
  test('identity helper preserves tokenized SSID and mixed manufacturer matching', () => {
    const ctx = new FilterBuildContext(
      { ssid: 'Home, Guest', manufacturer: 'Sierra Wireless, 28A331' },
      { ssid: true, manufacturer: true }
    );

    const where = buildFastPathIdentityPredicates(ctx);

    expect(where[0]).toContain('OR');
    expect(where[1]).toContain('OR');
    expect(ctx.getParams()).toEqual(['%Home%', '%Guest%', '%Sierra Wireless%', '28A331']);
    expect(ctx.getAppliedFilters().map((entry) => entry.field)).toEqual(['ssid', 'manufacturer']);
  });

  test('security helper keeps unknown encryption fallback parameterized', () => {
    const ctx = new FilterBuildContext(
      { encryptionTypes: [], securityFlags: ['enterprise'] },
      { encryptionTypes: true, securityFlags: true }
    );
    ctx.filters.encryptionTypes = ['UNKNOWN_VENDOR'] as any;

    const where = buildFastPathSecurityPredicates(ctx, { allowUnknownEncryptionFallback: true });

    expect(where).toHaveLength(2);
    expect(where[0]).toContain('= $1');
    expect(where[1]).toContain("IN ('WPA2-E', 'WPA3-E')");
    expect(ctx.getParams()).toEqual(['UNKNOWN_VENDOR']);
    expect(ctx.getAppliedFilters().map((entry) => entry.field)).toEqual([
      'encryptionTypes',
      'securityFlags',
    ]);
  });

  test('supplemental helper records unsupported WiGLE filter on non-WiGLE page', () => {
    const ctx = new FilterBuildContext(
      { wigle_v3_observation_count_min: 5 },
      { wigle_v3_observation_count_min: true }
    );

    const where = buildFastPathSupplementalPredicates(ctx, {
      addUnsupportedWigleIgnored: true,
    });

    expect(where).toEqual([]);
    expect(ctx.state.ignoredFilters()).toEqual([
      {
        type: 'quality',
        field: 'wigle_v3_observation_count_min',
        reason: 'unsupported_page',
      },
    ]);
  });

  test('supplemental helper maps threat-window timeframe to warning on fast path', () => {
    const ctx = new FilterBuildContext(
      {
        timeframe: { type: 'relative', relativeWindow: '7d' },
        temporalScope: 'threat_window',
        threatCategories: ['medium'],
      },
      { timeframe: true, temporalScope: true, threatCategories: true }
    );

    const where = buildFastPathSupplementalPredicates(ctx, {
      addUnsupportedWigleIgnored: true,
    });

    expect(where[0]).toContain('ne.threat_level = ANY');
    expect(where[1]).toContain('NOW() - $2::interval');
    expect(ctx.getParams()).toEqual([['MEDIUM', 'MED'], '7 days']);
    expect(ctx.state.warnings()).toContain(
      'Threat window scope mapped to observation_time on fast path.'
    );
  });
});
