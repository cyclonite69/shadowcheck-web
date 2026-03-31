export {};

import { FilterBuildContext } from '../../server/src/services/filterQueryBuilder/FilterBuildContext';
import { buildNetworkWhere } from '../../server/src/services/filterQueryBuilder/networkWhereBuilder';

describe('buildNetworkWhere', () => {
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
