export {};
/**
 * Regression tests for threat category filter/display alignment
 *
 * Covers:
 *  - Frontend lowercase → DB uppercase mapping (threatLevelMap)
 *  - Computed threat level thresholds match filter predicate values
 *  - HIGH rows do not appear in a CRITICAL-only filter
 *  - Edge-case mappings: medium→MED, none→NONE
 *
 * These tests exercise the same logic embedded in
 * server/src/api/routes/v1/networks/list.ts and the THREAT_LEVEL_EXPR
 * SQL expression (reflected here in JS for unit-level coverage).
 */

// ── Replicate the threatLevelMap from list.ts ────────────────────────────────

const threatLevelMap: Record<string, string> = {
  critical: 'CRITICAL',
  high: 'HIGH',
  medium: 'MED',
  low: 'LOW',
  none: 'NONE',
};

function mapCategories(raw: string[]): string[] {
  return raw.map((cat) => threatLevelMap[cat] || cat.toUpperCase()).filter(Boolean);
}

// ── Replicate the CASE expression from list.ts (threatLevelExpr) ─────────────
// threatScoreExpr: COALESCE(CASE WHEN tag='FALSE_POSITIVE'→0, INVESTIGATE→score,
//                 THREAT or default → score*0.7 + confidence*100*0.3)
// threatLevelExpr: CASE WHEN tag='FALSE_POSITIVE'→'NONE', INVESTIGATE→stored_level,
//                 ELSE CASE WHEN score>=80→CRITICAL …

function computeThreatScore(
  finalThreatScore: number,
  confidence: number,
  threatTag: string | null
): number {
  const score = finalThreatScore ?? 0;
  const conf = confidence ?? 0;
  if (threatTag === 'FALSE_POSITIVE') {
    return 0;
  }
  if (threatTag === 'INVESTIGATE') {
    return score;
  }
  return score * 0.7 + conf * 100 * 0.3;
}

function computeThreatLevel(
  finalThreatScore: number,
  confidence: number,
  threatTag: string | null,
  storedLevel: string | null
): string {
  if (threatTag === 'FALSE_POSITIVE') {
    return 'NONE';
  }
  if (threatTag === 'INVESTIGATE') {
    return storedLevel ?? 'NONE';
  }
  const s = computeThreatScore(finalThreatScore, confidence, threatTag);
  if (s >= 80) {
    return 'CRITICAL';
  }
  if (s >= 60) {
    return 'HIGH';
  }
  if (s >= 40) {
    return 'MED';
  }
  if (s >= 20) {
    return 'LOW';
  }
  return 'NONE';
}

// ── Category mapping tests ───────────────────────────────────────────────────

describe('threatLevelMap – frontend → DB category mapping', () => {
  it('maps "critical" to "CRITICAL"', () => {
    expect(mapCategories(['critical'])).toEqual(['CRITICAL']);
  });

  it('maps "high" to "HIGH"', () => {
    expect(mapCategories(['high'])).toEqual(['HIGH']);
  });

  it('maps "medium" to "MED" (not MEDIUM)', () => {
    expect(mapCategories(['medium'])).toEqual(['MED']);
  });

  it('maps "low" to "LOW"', () => {
    expect(mapCategories(['low'])).toEqual(['LOW']);
  });

  it('maps "none" to "NONE"', () => {
    expect(mapCategories(['none'])).toEqual(['NONE']);
  });

  it('maps multiple categories in one call', () => {
    expect(mapCategories(['critical', 'high'])).toEqual(['CRITICAL', 'HIGH']);
  });

  it('falls back to toUpperCase for unrecognised category', () => {
    // e.g. if server passes an already-uppercased value, it survives unchanged
    expect(mapCategories(['CRITICAL'])).toEqual(['CRITICAL']);
  });
});

// ── Score formula tests ───────────────────────────────────────────────────────
// The runtime formula is: final_threat_score * 0.7 + confidence * 100 * 0.3
// So a stored score of 100 with confidence=0 → computed 70 (HIGH, not CRITICAL).
// CRITICAL requires computed >= 80, which needs high confidence or very high stored score.

describe('computeThreatScore – blending formula', () => {
  it('FALSE_POSITIVE always yields 0 regardless of stored score', () => {
    expect(computeThreatScore(100, 1, 'FALSE_POSITIVE')).toBe(0);
  });

  it('INVESTIGATE returns stored score without blending', () => {
    expect(computeThreatScore(75, 0.5, 'INVESTIGATE')).toBe(75);
  });

  it('default: blends final_threat_score*0.7 + confidence*100*0.3', () => {
    // 100 * 0.7 + 0.5 * 100 * 0.3 = 70 + 15 = 85
    expect(computeThreatScore(100, 0.5, null)).toBeCloseTo(85, 5);
  });

  it('confidence=0 reduces to 70% of stored score', () => {
    expect(computeThreatScore(100, 0, null)).toBeCloseTo(70, 5);
  });
});

// ── Threshold / computed level tests ─────────────────────────────────────────
// Inputs chosen so that final_threat_score * 0.7 + confidence * 100 * 0.3
// lands at/above the threshold boundary for each expected level.

describe('computeThreatLevel – threshold boundaries', () => {
  const NO_TAG = null;

  // 100*0.7 + 0.5*100*0.3 = 70+15 = 85 → CRITICAL
  it('computed 85 → CRITICAL', () => {
    expect(computeThreatLevel(100, 0.5, NO_TAG, null)).toBe('CRITICAL');
  });

  // 100*0.7 + 0*30 = 70 → HIGH (>=60, <80)
  it('computed 70 → HIGH (not CRITICAL)', () => {
    expect(computeThreatLevel(100, 0, NO_TAG, null)).toBe('HIGH');
  });

  // 90*0.7 + 0*30 = 63 → HIGH
  it('computed 63 → HIGH', () => {
    expect(computeThreatLevel(90, 0, NO_TAG, null)).toBe('HIGH');
  });

  // 79*0.7 + 0*30 = 55.3 → MED (<60)
  it('computed 55.3 → MED (not HIGH)', () => {
    expect(computeThreatLevel(79, 0, NO_TAG, null)).toBe('MED');
  });

  // 60*0.7 + 0*30 = 42 → MED
  it('computed 42 → MED', () => {
    expect(computeThreatLevel(60, 0, NO_TAG, null)).toBe('MED');
  });

  // 55*0.7 + 0*30 = 38.5 → LOW (<40)
  it('computed 38.5 → LOW (not MED)', () => {
    expect(computeThreatLevel(55, 0, NO_TAG, null)).toBe('LOW');
  });

  // 30*0.7 + 0*30 = 21 → LOW
  it('computed 21 → LOW', () => {
    expect(computeThreatLevel(30, 0, NO_TAG, null)).toBe('LOW');
  });

  // 25*0.7 + 0*30 = 17.5 → NONE (<20)
  it('computed 17.5 → NONE', () => {
    expect(computeThreatLevel(25, 0, NO_TAG, null)).toBe('NONE');
  });

  // 0*0.7 + 0*30 = 0 → NONE
  it('computed 0 → NONE', () => {
    expect(computeThreatLevel(0, 0, NO_TAG, null)).toBe('NONE');
  });
});

// ── Filter predicate alignment (regression for the display/filter mismatch) ──

describe('filter predicate alignment – computed level matches filter value', () => {
  /**
   * The WHERE clause uses (threatLevelExpr) = ANY($categories::text[]).
   * The SELECT now also returns (threatLevelExpr) AS final_threat_level.
   * These tests confirm a row's displayed level is exactly what the filter
   * would accept, preventing HIGH rows from appearing in a CRITICAL filter.
   */

  function rowPassesFilter(
    row: {
      finalThreatScore: number;
      confidence: number;
      threatTag: string | null;
      storedLevel: string | null;
    },
    allowedCategories: string[]
  ): boolean {
    const level = computeThreatLevel(
      row.finalThreatScore,
      row.confidence,
      row.threatTag,
      row.storedLevel
    );
    return allowedCategories.includes(level);
  }

  // computed = 100*0.7 + 0.5*100*0.3 = 70+15 = 85 → CRITICAL
  const criticalRow = {
    finalThreatScore: 100,
    confidence: 0.5,
    threatTag: null,
    storedLevel: null,
  };
  // computed = 100*0.7 + 0*30 = 70 → HIGH
  const highRow = { finalThreatScore: 100, confidence: 0, threatTag: null, storedLevel: null };
  // computed = 60*0.7 + 0*30 = 42 → MED
  const medRow = { finalThreatScore: 60, confidence: 0, threatTag: null, storedLevel: null };
  // computed = 5*0.7 + 0*30 = 3.5 → NONE
  const noneRow = { finalThreatScore: 5, confidence: 0, threatTag: null, storedLevel: null };
  const fpRow = {
    finalThreatScore: 95,
    confidence: 1,
    threatTag: 'FALSE_POSITIVE',
    storedLevel: null,
  };

  it('CRITICAL row passes CRITICAL filter', () => {
    expect(rowPassesFilter(criticalRow, ['CRITICAL'])).toBe(true);
  });

  it('HIGH row does NOT pass CRITICAL-only filter', () => {
    expect(rowPassesFilter(highRow, ['CRITICAL'])).toBe(false);
  });

  it('HIGH row passes HIGH filter', () => {
    expect(rowPassesFilter(highRow, ['HIGH'])).toBe(true);
  });

  it('MED row passes MED filter', () => {
    expect(rowPassesFilter(medRow, ['MED'])).toBe(true);
  });

  it('MED row does NOT pass HIGH or CRITICAL filter', () => {
    expect(rowPassesFilter(medRow, ['HIGH', 'CRITICAL'])).toBe(false);
  });

  it('NONE row passes NONE filter', () => {
    expect(rowPassesFilter(noneRow, ['NONE'])).toBe(true);
  });

  it('FALSE_POSITIVE with high raw score is treated as NONE', () => {
    // A tagged FALSE_POSITIVE must never appear in CRITICAL/HIGH filters
    expect(rowPassesFilter(fpRow, ['CRITICAL'])).toBe(false);
    expect(rowPassesFilter(fpRow, ['HIGH'])).toBe(false);
    expect(rowPassesFilter(fpRow, ['NONE'])).toBe(true);
  });

  it('multi-category filter [CRITICAL, HIGH] matches both levels', () => {
    expect(rowPassesFilter(criticalRow, ['CRITICAL', 'HIGH'])).toBe(true);
    expect(rowPassesFilter(highRow, ['CRITICAL', 'HIGH'])).toBe(true);
    expect(rowPassesFilter(medRow, ['CRITICAL', 'HIGH'])).toBe(false);
  });
});
