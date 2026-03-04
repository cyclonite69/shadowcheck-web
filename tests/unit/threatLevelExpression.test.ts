export {};

import { THREAT_LEVEL_EXPR } from '../../server/src/services/filterQueryBuilder/sqlExpressions';

describe('THREAT_LEVEL_EXPR', () => {
  test('prefers persisted final_threat_level before fallback score thresholds', () => {
    const expr = THREAT_LEVEL_EXPR('nts', 'nt');

    // FALSE_POSITIVE tag override remains strongest
    expect(expr).toContain("WHEN nt.threat_tag = 'FALSE_POSITIVE' THEN 'NONE'");

    // Non-tagged path must honor persisted level to prevent category mismatch
    expect(expr).toContain('COALESCE(');
    expect(expr).toContain('nts.final_threat_level');

    // Fallback still retains computed thresholds when persisted level missing
    expect(expr).toContain(">= 60 THEN 'HIGH'");
  });
});
