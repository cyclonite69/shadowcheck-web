export {};

import { buildEngagementPredicates } from '../../server/src/services/filterQueryBuilder/engagementPredicates';
import { DEFAULT_ENABLED } from '../../server/src/services/filterQueryBuilder/constants';

const makeAddParam = () => {
  const params: unknown[] = [];
  const addParam = (value: unknown) => {
    params.push(value);
    return `$${params.length}`;
  };
  return { params, addParam };
};

describe('buildEngagementPredicates', () => {
  test('builds has_notes predicate for true', () => {
    const { addParam } = makeAddParam();
    const result = buildEngagementPredicates({
      enabled: { ...DEFAULT_ENABLED, has_notes: true },
      filters: { has_notes: true },
      addParam,
      bssidExpr: 'ne.bssid',
      tagAlias: 'nt',
      tagLowerExpr: 'LOWER(nt.tag)',
      tagIgnoredExpr: 'COALESCE(nt.is_ignored, FALSE)',
    });

    expect(result.where).toHaveLength(1);
    expect(result.where[0]).toContain('EXISTS');
    expect(result.where[0]).toContain('app.network_notes nn');
    expect(result.applied).toContainEqual({ field: 'has_notes', value: true });
  });

  test('builds tag_type predicate for tags + ignore', () => {
    const { params, addParam } = makeAddParam();
    const result = buildEngagementPredicates({
      enabled: { ...DEFAULT_ENABLED, tag_type: true },
      filters: { tag_type: ['threat', 'ignore'] },
      addParam,
      bssidExpr: 'ne.bssid',
      tagAlias: 'nt_filter',
      tagLowerExpr: 'LOWER(nt_filter.tag)',
      tagIgnoredExpr: 'COALESCE(nt_filter.is_ignored, FALSE)',
    });

    expect(result.where).toHaveLength(1);
    expect(result.where[0]).toContain('EXISTS');
    expect(result.where[0]).toContain('nt_filter');
    expect(result.where[0]).toContain('LOWER(nt_filter.tag) = ANY($1)');
    expect(result.where[0]).toContain('COALESCE(nt_filter.is_ignored, FALSE) IS TRUE');
    expect(params).toEqual([['threat']]);
    expect(result.applied).toContainEqual({ field: 'tag_type', value: ['threat', 'ignore'] });
  });

  test('builds ignore-only tag_type predicate without params', () => {
    const { params, addParam } = makeAddParam();
    const result = buildEngagementPredicates({
      enabled: { ...DEFAULT_ENABLED, tag_type: true },
      filters: { tag_type: ['ignore'] },
      addParam,
      bssidExpr: 'ne.bssid',
      tagAlias: 'nt',
      tagLowerExpr: 'LOWER(nt.tag)',
      tagIgnoredExpr: 'COALESCE(nt.is_ignored, FALSE)',
    });

    expect(result.where).toHaveLength(1);
    expect(result.where[0]).toContain('COALESCE(nt.is_ignored, FALSE) IS TRUE');
    expect(params).toEqual([]);
  });
});
