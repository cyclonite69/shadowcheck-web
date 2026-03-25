/**
 * Unit tests for networkSqlExpressions
 *
 * Pure-function tests — no DB connection or mocking required.
 * Verifies SQL fragment structure and content for all exported builders.
 */

export {};

import {
  openPredicate,
  encryptionTypePredicate,
  buildEncryptionTypeCondition,
  authMethodPredicate,
  buildAuthMethodCondition,
  buildThreatScoreExpr,
  buildThreatLevelExpr,
  buildTypeExpr,
  buildDistanceExpr,
} from '../../server/src/utils/networkSqlExpressions';

// ── openPredicate ────────────────────────────────────────────────────────────

describe('openPredicate', () => {
  it('matches NULL security', () => {
    const result = openPredicate(1);
    expect(result.sql).toContain('IS NULL');
  });

  it('matches empty string security', () => {
    const result = openPredicate(1);
    expect(result.sql).toContain("= ''");
  });

  it('excludes rows with recognised encryption keywords via !~*', () => {
    const result = openPredicate(1);
    expect(result.sql).toContain('!~*');
    expect(result.sql).toContain('$1');
    expect(result.params[0]).toMatch(/WPA|WEP|RSN/);
  });
});

// ── encryptionTypePredicate ───────────────────────────────────────────────────

describe('encryptionTypePredicate', () => {
  it('OPEN returns the openPredicate result', () => {
    const result = encryptionTypePredicate('OPEN', 1);
    expect(result.sql).toContain('IS NULL');
    expect(result.params).toHaveLength(1);
  });

  it('NONE (legacy alias) also returns the openPredicate result', () => {
    const result = encryptionTypePredicate('NONE', 1);
    expect(result.sql).toContain('IS NULL');
  });

  it('WEP returns a predicate containing WEP ILIKE placeholder', () => {
    const result = encryptionTypePredicate('WEP', 1);
    expect(result.sql).toContain('ne.security ILIKE $1');
    expect(result.params).toEqual(['%WEP%']);
  });

  it('WPA returns predicate that includes WPA but excludes WPA2 and WPA3 with placeholders', () => {
    const result = encryptionTypePredicate('WPA', 1);
    expect(result.sql).toContain('ne.security ILIKE $1');
    expect(result.sql).toContain('ne.security NOT ILIKE $2');
    expect(result.sql).toContain('ne.security NOT ILIKE $3');
    expect(result.sql).toContain('ne.security !~* $4');
    expect(result.params).toEqual(['%WPA%', '%WPA2%', '%WPA3%', '(RSN|SAE)']);
  });

  it('WPA2 predicate includes RSN and excludes WPA3 with placeholders', () => {
    const result = encryptionTypePredicate('WPA2', 1);
    expect(result.sql).toContain('ILIKE $1');
    expect(result.sql).toContain('OR ne.security ~* $2');
    expect(result.sql).toContain('NOT ILIKE $3');
    expect(result.params).toEqual(['%WPA2%', 'RSN', '%WPA3%']);
  });

  it('WPA3 predicate includes SAE (WPA3-Personal) and WPA3 with placeholders', () => {
    const result = encryptionTypePredicate('WPA3', 1);
    expect(result.sql).toContain('ILIKE $1');
    expect(result.sql).toContain('OR ne.security ~* $2');
    expect(result.params).toEqual(['%WPA3%', 'SAE']);
  });

  it('OWE returns a predicate matching OWE with placeholder', () => {
    const result = encryptionTypePredicate('OWE', 1);
    expect(result.sql).toContain('ne.security ~* $1');
    expect(result.params).toEqual(['OWE']);
  });

  it('SAE returns a predicate matching SAE with placeholder', () => {
    const result = encryptionTypePredicate('SAE', 1);
    expect(result.sql).toContain('ne.security ~* $1');
    expect(result.params).toEqual(['SAE']);
  });

  it('unknown type falls through to generic ILIKE with the value as parameter', () => {
    const result = encryptionTypePredicate('CUSTOM_TYPE', 1);
    expect(result.sql).toContain('ne.security ILIKE $1');
    expect(result.params).toEqual(['%CUSTOM_TYPE%']);
  });

  it('accepts lowercase input (case-insensitive switch)', () => {
    expect(encryptionTypePredicate('wpa3', 1)).toEqual(encryptionTypePredicate('WPA3', 1));
  });
});

// ── buildEncryptionTypeCondition ──────────────────────────────────────────────

describe('buildEncryptionTypeCondition', () => {
  it('returns null for an empty array', () => {
    expect(buildEncryptionTypeCondition([], 1)).toBeNull();
  });

  it('returns null for a falsy argument', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(buildEncryptionTypeCondition(null as any, 1)).toBeNull();
  });

  it('wraps a single type in outer parentheses', () => {
    const result = buildEncryptionTypeCondition(['WEP'], 1);
    expect(result).not.toBeNull();
    expect(result!.sql.startsWith('(')).toBe(true);
    expect(result!.sql.endsWith(')')).toBe(true);
    expect(result!.sql).toContain('$1');
    expect(result!.params).toEqual(['%WEP%']);
  });

  it('joins multiple types with OR and increments placeholders', () => {
    const result = buildEncryptionTypeCondition(['WEP', 'SAE'], 1);
    expect(result).not.toBeNull();
    expect(result!.sql).toMatch(/\bOR\b/);
    expect(result!.sql).toContain('$1');
    expect(result!.sql).toContain('$2');
    expect(result!.params).toEqual(['%WEP%', 'SAE']);
  });

  it('handles complex types with multiple parameters correctly', () => {
    const result = buildEncryptionTypeCondition(['WPA', 'WPA3'], 1);
    // WPA uses 4 params, WPA3 uses 2 params. Total 6.
    expect(result!.params).toHaveLength(6);
    expect(result!.sql).toContain('$1');
    expect(result!.sql).toContain('$4');
    expect(result!.sql).toContain('$5');
    expect(result!.sql).toContain('$6');
  });
});

// ── authMethodPredicate ──────────────────────────────────────────────────────

describe('authMethodPredicate', () => {
  it('NONE returns a predicate matching NULL/empty or NONE', () => {
    const result = authMethodPredicate('NONE', 1);
    expect(result.sql).toContain('ne.auth IS NULL');
    expect(result.sql).toContain('ILIKE $1');
    expect(result.params).toEqual(['%NONE%']);
  });

  it('specific method returns ILIKE placeholder', () => {
    const result = authMethodPredicate('PSK', 1);
    expect(result.sql).toBe('ne.auth ILIKE $1');
    expect(result.params).toEqual(['%PSK%']);
  });
});

// ── buildAuthMethodCondition ─────────────────────────────────────────────────

describe('buildAuthMethodCondition', () => {
  it('returns null for empty array', () => {
    expect(buildAuthMethodCondition([], 1)).toBeNull();
  });

  it('joins multiple methods with OR', () => {
    const result = buildAuthMethodCondition(['PSK', 'EAP'], 1);
    expect(result!.sql).toBe('(ne.auth ILIKE $1 OR ne.auth ILIKE $2)');
    expect(result!.params).toEqual(['%PSK%', '%EAP%']);
  });
});

// ── buildThreatScoreExpr ──────────────────────────────────────────────────────

describe('buildThreatScoreExpr', () => {
  describe('default scoring (simpleScoring = false)', () => {
    const expr = buildThreatScoreExpr(false);

    it('references ne.threat_score', () => {
      expect(expr).toContain('ne.threat_score');
    });

    it('returns 0 for FALSE_POSITIVE', () => {
      expect(expr).toMatch(/FALSE_POSITIVE.*THEN 0/s);
    });

    it('wraps result in COALESCE', () => {
      expect(expr).toMatch(/COALESCE/i);
    });
  });

  describe('simple scoring (simpleScoring = true)', () => {
    const expr = buildThreatScoreExpr(true);

    it('references rule_based_score instead of threat_score', () => {
      expect(expr).toContain('rule_based_score');
      expect(expr).not.toContain('ne.threat_score');
    });
  });
});

// ── buildThreatLevelExpr ──────────────────────────────────────────────────────

describe('buildThreatLevelExpr', () => {
  const scoreExpr = 'calculated_score';
  const levelExpr = buildThreatLevelExpr(scoreExpr);

  it('embeds the passed score expression in the output', () => {
    expect(levelExpr).toContain(scoreExpr);
  });

  it('maps >= 80 to CRITICAL', () => {
    expect(levelExpr).toMatch(/>= 80.*CRITICAL/s);
  });

  it('maps >= 60 to HIGH', () => {
    expect(levelExpr).toMatch(/>= 60.*HIGH/s);
  });

  it('maps >= 40 to MED', () => {
    expect(levelExpr).toMatch(/>= 40.*MED/s);
  });

  it('maps >= 20 to LOW', () => {
    expect(levelExpr).toMatch(/>= 20.*LOW/s);
  });

  it('falls back to NONE', () => {
    expect(levelExpr).toContain("'NONE'");
  });

  it('short-circuits FALSE_POSITIVE to NONE', () => {
    expect(levelExpr).toMatch(/FALSE_POSITIVE.*NONE/s);
  });
});

// ── buildTypeExpr ─────────────────────────────────────────────────────────────

describe('buildTypeExpr', () => {
  const expr = buildTypeExpr(); // default alias 'ne'

  it('uses the default table alias ne', () => {
    expect(expr).toContain('ne.type');
    expect(expr).toContain('ne.frequency');
  });

  it('maps WiFi aliases to W', () => {
    expect(expr).toMatch(/WIFI.*THEN 'W'/i);
  });

  it('maps BLE aliases to E', () => {
    expect(expr).toMatch(/BLE.*THEN 'E'/i);
  });

  it('maps LTE/4G aliases to L', () => {
    expect(expr).toMatch(/LTE.*THEN 'L'/i);
  });

  it('maps NR/5G aliases to N', () => {
    expect(expr).toMatch(/NR.*THEN 'N'/i);
  });

  it('maps GSM/2G aliases to G', () => {
    expect(expr).toMatch(/GSM.*THEN 'G'/i);
  });

  it('infers WiFi from frequency range 2412–7125', () => {
    expect(expr).toContain('BETWEEN 2412 AND 7125');
  });

  it('infers WiFi from security string patterns (WPA|WEP|ESS|RSN)', () => {
    expect(expr).toMatch(/WPA|WEP|ESS|RSN/);
  });

  it('uses a custom alias when provided', () => {
    const customExpr = buildTypeExpr('n');
    expect(customExpr).toContain('n.type');
    expect(customExpr).not.toContain('ne.type');
  });
});

// ── buildDistanceExpr ─────────────────────────────────────────────────────────

describe('buildDistanceExpr', () => {
  const lat = 37.4219;
  const lon = -122.084;
  const expr = buildDistanceExpr(lat, lon);

  it('uses ST_Distance for distance calculation', () => {
    expect(expr).toContain('ST_Distance');
  });

  it('embeds the home latitude as a numeric literal', () => {
    expect(expr).toContain(String(lat));
  });

  it('embeds the home longitude as a numeric literal', () => {
    expect(expr).toContain(String(lon));
  });

  it('divides by 1000 to convert metres to km', () => {
    expect(expr).toContain('/ 1000');
  });

  it('joins on the network bssid using the default ne alias', () => {
    expect(expr).toContain('ne.bssid');
  });

  it('scans observations with the default o alias', () => {
    expect(expr).toContain('FROM app.observations o');
  });

  it('uses custom aliases when provided', () => {
    const customExpr = buildDistanceExpr(lat, lon, 'net', 'obs');
    expect(customExpr).toContain('net.bssid');
    expect(customExpr).toContain('FROM app.observations obs');
  });

  it('casts coordinates to geography type', () => {
    expect(expr).toContain('::geography');
  });
});
