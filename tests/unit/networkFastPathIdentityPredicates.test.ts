export {};

import { FilterBuildContext } from '../../server/src/services/filterQueryBuilder/FilterBuildContext';
import { buildFastPathIdentityPredicates } from '../../server/src/services/filterQueryBuilder/modules/networkFastPathIdentityPredicates';

describe('buildFastPathIdentityPredicates — negation and OR-groups', () => {
  test('negated SSID with dash prefix excludes via NOT ILIKE and NOT EXISTS', () => {
    const ctx = new FilterBuildContext({ ssid: '-Starbucks' }, { ssid: true });
    const where = buildFastPathIdentityPredicates(ctx);

    expect(where).toHaveLength(1);
    expect(where[0]).toContain('NOT ILIKE');
    expect(where[0]).toContain('NOT EXISTS');
    expect(ctx.getParams()).toEqual(['%Starbucks%']);
  });

  test('negated SSID with NOT prefix excludes via NOT ILIKE and NOT EXISTS', () => {
    const ctx = new FilterBuildContext({ ssid: 'NOT Corp' }, { ssid: true });
    const where = buildFastPathIdentityPredicates(ctx);

    expect(where[0]).toContain('NOT ILIKE');
    expect(where[0]).toContain('NOT EXISTS');
    expect(ctx.getParams()).toEqual(['%Corp%']);
  });

  test('SSID OR-group (pipe syntax) produces OR-joined predicates', () => {
    const ctx = new FilterBuildContext({ ssid: 'Home|Guest' }, { ssid: true });
    const where = buildFastPathIdentityPredicates(ctx);

    expect(where).toHaveLength(1);
    expect(where[0]).toContain(' OR ');
    // Two params — one per alternative
    expect(ctx.getParams()).toHaveLength(2);
  });

  test('negated SSID OR-group produces AND-joined NOT predicates (De Morgan)', () => {
    const ctx = new FilterBuildContext({ ssid: '-Home|Guest' }, { ssid: true });
    const where = buildFastPathIdentityPredicates(ctx);

    expect(where[0]).toContain(' AND ');
    expect(where[0]).toContain('NOT ILIKE');
  });

  test('SSID wildcard (* glob) is converted to SQL LIKE pattern', () => {
    const ctx = new FilterBuildContext({ ssid: 'xfinity*' }, { ssid: true });
    const _where = buildFastPathIdentityPredicates(ctx);

    // normalizeWildcards converts * → %, so param should end with %
    expect(ctx.getParams()[0]).toMatch(/%$/);
    // Should NOT wrap in extra %…% since it already contains a wildcard
    expect(ctx.getParams()[0]).not.toMatch(/^%.*%$/);
  });
});

describe('buildFastPathIdentityPredicates — BSSID matching', () => {
  test('exact 17-char BSSID uses equality operator', () => {
    const ctx = new FilterBuildContext({ bssid: 'AA:BB:CC:DD:EE:FF' }, { bssid: true });
    const where = buildFastPathIdentityPredicates(ctx);

    expect(where[0]).toContain('= $1');
    expect(ctx.getParams()).toEqual(['AA:BB:CC:DD:EE:FF']);
  });

  test('partial BSSID prefix uses LIKE with trailing wildcard', () => {
    const ctx = new FilterBuildContext({ bssid: 'AA:BB:CC' }, { bssid: true });
    const where = buildFastPathIdentityPredicates(ctx);

    expect(where[0]).toContain('LIKE');
    expect(ctx.getParams()[0]).toMatch(/%$/);
  });

  test('negated exact BSSID uses != operator', () => {
    const ctx = new FilterBuildContext({ bssid: '-AA:BB:CC:DD:EE:FF' }, { bssid: true });
    const where = buildFastPathIdentityPredicates(ctx);

    expect(where[0]).toContain('!= $1');
  });

  test('negated partial BSSID uses NOT LIKE', () => {
    const ctx = new FilterBuildContext({ bssid: '-AA:BB' }, { bssid: true });
    const where = buildFastPathIdentityPredicates(ctx);

    expect(where[0]).toContain('NOT LIKE');
  });
});

describe('buildFastPathIdentityPredicates — manufacturer', () => {
  test('OUI string routes to hex prefix equality check', () => {
    const ctx = new FilterBuildContext({ manufacturer: '28:A3:31' }, { manufacturer: true });
    const where = buildFastPathIdentityPredicates(ctx);

    expect(where[0]).toContain('SUBSTRING(ne.bssid, 1, 8)');
    expect(ctx.getParams()).toEqual(['28A331']);
  });

  test('non-OUI manufacturer string uses ILIKE substring match', () => {
    const ctx = new FilterBuildContext({ manufacturer: 'Apple' }, { manufacturer: true });
    const where = buildFastPathIdentityPredicates(ctx);

    expect(where[0]).toContain('ne.manufacturer ILIKE');
    expect(ctx.getParams()).toEqual(['%Apple%']);
  });
});
