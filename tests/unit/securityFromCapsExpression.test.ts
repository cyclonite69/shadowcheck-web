export {};

import { SECURITY_FROM_CAPS_EXPR } from '../../server/src/services/filterQueryBuilder/sqlExpressions';

describe('SECURITY_FROM_CAPS_EXPR', () => {
  test('normalizes placeholder/open aliases before regex-based classification', () => {
    const expr = SECURITY_FROM_CAPS_EXPR('ne.security');

    expect(expr).toContain("BTRIM(COALESCE(ne.security, '')) = ''");
    expect(expr).toContain(
      "IN ('---', '-', 'N/A', 'NA', 'NONE', 'OPEN', 'OPEN/UNKNOWN') THEN 'OPEN'"
    );
    expect(expr).toContain("= 'UNKNOWN' THEN 'UNKNOWN'");
  });
});
