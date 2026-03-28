export {};

import {
  buildExplorerV2OrderClause,
  getThreatLevelSort,
  resolveLegacySortColumn,
} from '../../server/src/services/explorerSorting';

describe('explorer sorting helpers', () => {
  it('resolves legacy sort columns with a last_seen fallback', () => {
    expect(resolveLegacySortColumn('ssid')).toBe('ssid');
    expect(resolveLegacySortColumn('unknown')).toBe('last_seen');
  });

  it('builds ascending and descending threat sort CASE expressions', () => {
    expect(getThreatLevelSort('asc')).toContain("WHEN threat->>'level' = 'NONE' THEN 1");
    expect(getThreatLevelSort('desc')).toContain("WHEN threat->>'level' = 'CRITICAL' THEN 1");
  });

  it('builds v2 order clauses for mixed special-case and mapped columns', () => {
    const clause = buildExplorerV2OrderClause('threat,threat_score,manufacturer', 'asc,desc,asc');

    expect(clause).toContain("CASE WHEN threat->>'level' = 'NONE' THEN 1");
    expect(clause).toContain("(threat->>'score')::numeric DESC NULLS LAST");
    expect(clause).toContain('manufacturer ASC NULLS LAST');
  });
});
