export {};

import { FilterBuildContext } from '../../server/src/services/filterQueryBuilder/FilterBuildContext';
import { buildNetworkWhere } from '../../server/src/services/filterQueryBuilder/networkWhereBuilder';

describe('buildNetworkWhere', () => {
  describe('SSID pipe OR syntax', () => {
    const ssidCtx = (ssid: string) => new FilterBuildContext({ ssid }, { ssid: true });

    test('single token — no pipe, unchanged behavior', () => {
      const where = buildNetworkWhere(ssidCtx('fbi'));
      expect(where[0]).toMatch(/ne\.ssid ILIKE \$1/);
      expect(where[0]).toMatch(/o2\.ssid.*ILIKE \$1/);
      expect(ssidCtx('fbi').getParams()).toEqual([]); // params belong to ctx inside test
    });

    test('pipe token generates OR clause for both ssid column and history subquery', () => {
      const ctx = ssidCtx('fbi|surveillance');
      const where = buildNetworkWhere(ctx);
      expect(where[0]).toContain('OR');
      expect(where[0]).toMatch(/ne\.ssid ILIKE \$1/);
      expect(where[0]).toMatch(/ne\.ssid ILIKE \$2/);
      expect(ctx.getParams()).toEqual(['%fbi%', '%surveillance%']);
    });

    test('comma tokens still join with AND', () => {
      const ctx = ssidCtx('fbi,surveillance');
      const where = buildNetworkWhere(ctx);
      expect(where[0]).toMatch(/AND/);
      expect(ctx.getParams()).toEqual(['%fbi%', '%surveillance%']);
    });

    test('pipe + comma: (fbi|surveillance) AND mobile', () => {
      const ctx = ssidCtx('fbi|surveillance,mobile');
      const where = buildNetworkWhere(ctx);
      // outer AND from comma split
      expect(where[0]).toMatch(/AND/);
      // inner OR from pipe split
      expect(where[0]).toMatch(/OR/);
      expect(ctx.getParams()).toEqual(['%fbi%', '%surveillance%', '%mobile%']);
    });

    test('negated pipe: -fbi|surveillance → NOT fbi AND NOT surveillance', () => {
      const ctx = ssidCtx('-fbi|surveillance');
      const where = buildNetworkWhere(ctx);
      expect(where[0]).toMatch(/NOT ILIKE \$1/);
      expect(where[0]).toMatch(/NOT ILIKE \$2/);
      expect(where[0]).toMatch(/AND/);
      expect(ctx.getParams()).toEqual(['%fbi%', '%surveillance%']);
    });
  });

  test('applies threat categories, observation count, and timeframe filters', () => {
    const ctx = new FilterBuildContext(
      {
        threatCategories: ['medium'],
        observationCountMin: 5,
        timeframe: { type: 'relative', relativeWindow: '7d' },
      },
      {
        threatCategories: true,
        observationCountMin: true,
        timeframe: true,
      }
    );

    const where = buildNetworkWhere(ctx);

    expect(where[0]).toContain('ne.threat_level = ANY');
    expect(where[1]).toContain('ne.observations >= $2');
    expect(where[2]).toContain('ne.last_seen >= NOW() - $3::interval');
    expect(ctx.getParams()).toEqual([['MEDIUM', 'MED'], 5, '7 days']);
    expect(ctx.getAppliedFilters().map((entry) => entry.field)).toEqual([
      'threatCategories',
      'observationCountMin',
      'timeframe',
    ]);
  });
});
