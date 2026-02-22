/**
 * Shared SQL expression builders for network queries.
 *
 * Single source of truth for:
 *  - Security/encryption type predicates  (OPEN_PREDICATE, buildEncryptionTypeCondition)
 *  - Threat score / level CASE expressions (buildThreatScoreExpr, buildThreatLevelExpr)
 *
 * Used by:
 *  - server/src/api/routes/v1/networks/list.ts
 *
 * Future consumers:
 *  - filterQueryBuilder (v2 filtered endpoint) — see audit section 4.3
 */

export {};

// ── Security predicates ────────────────────────────────────────────────────

/**
 * SQL predicate that matches open / unencrypted networks.
 *
 * Rows match if security is NULL, empty, or contains no recognised
 * encryption keywords.  ESS / IBSS are infrastructure-mode flags, not
 * encryption markers, and are intentionally absent from the exclusion list.
 */
export const OPEN_PREDICATE = `(ne.security IS NULL OR ne.security = '' OR ne.security !~* '(WPA|WEP|RSN|CCMP|TKIP|OWE|SAE)')`;

/**
 * Map a single canonical encryption type value to its SQL WHERE clause.
 *
 * @param enc  Canonical type (e.g. 'OPEN', 'WEP', 'WPA', 'WPA2', 'WPA3',
 *             'OWE', 'SAE').  Unknown values fall through to a generic ILIKE.
 */
export function encryptionTypePredicate(enc: string): string {
  switch (enc.toUpperCase()) {
    case 'OPEN':
    case 'NONE': // legacy alias
      return OPEN_PREDICATE;

    case 'WEP':
      return `ne.security ILIKE '%WEP%'`;

    case 'WPA':
      // WPA v1 only — explicitly exclude WPA2/WPA3 and RSN/SAE rows
      return (
        `(ne.security ILIKE '%WPA%'` +
        ` AND ne.security NOT ILIKE '%WPA2%'` +
        ` AND ne.security NOT ILIKE '%WPA3%'` +
        ` AND ne.security !~* '(RSN|SAE)')`
      );

    case 'WPA2':
      // WPA2 or RSN-tagged rows, excluding WPA3
      return `((ne.security ILIKE '%WPA2%' OR ne.security ~* 'RSN') AND ne.security NOT ILIKE '%WPA3%')`;

    case 'WPA3':
      // WPA3 or SAE (WPA3-Personal)
      return `(ne.security ILIKE '%WPA3%' OR ne.security ~* 'SAE')`;

    case 'OWE':
      return `ne.security ~* 'OWE'`;

    case 'SAE':
      return `ne.security ~* 'SAE'`;

    default:
      // Generic ILIKE fallback — safe because enc has been parsed from a
      // comma-separated list and is not directly from user input.
      return `ne.security ILIKE '%${enc.replace(/'/g, "''")}%'`;
  }
}

/**
 * Build a combined SQL WHERE condition for an `encryptionTypes` filter list.
 *
 * Returns null when the list is empty (caller should skip the clause).
 */
export function buildEncryptionTypeCondition(types: string[]): string | null {
  if (!types || types.length === 0) return null;
  const clauses = types.map(encryptionTypePredicate);
  return `(${clauses.join(' OR ')})`;
}

// ── Threat score / level expressions ──────────────────────────────────────

/**
 * Build the threat-score SQL CASE expression.
 *
 * @param simpleScoring  When true, uses `rule_based_score` only
 *                       (SIMPLE_RULE_SCORING_ENABLED feature flag).
 */
export function buildThreatScoreExpr(simpleScoring = false): string {
  if (simpleScoring) {
    return `COALESCE(
      CASE
        WHEN nt.threat_tag = 'FALSE_POSITIVE' THEN 0
        WHEN nt.threat_tag = 'INVESTIGATE'    THEN COALESCE(nts.rule_based_score, 0)::numeric
        ELSE                                       COALESCE(nts.rule_based_score, 0)::numeric
      END,
      0
    )`;
  }

  return `COALESCE(
      CASE
        WHEN nt.threat_tag = 'FALSE_POSITIVE' THEN 0
        WHEN nt.threat_tag = 'INVESTIGATE' THEN COALESCE(nts.final_threat_score, 0)::numeric
        WHEN nt.threat_tag = 'THREAT' THEN (COALESCE(nts.final_threat_score, 0)::numeric * 0.7 + COALESCE(nt.threat_confidence, 0)::numeric * 100 * 0.3)
        ELSE (COALESCE(nts.final_threat_score, 0)::numeric * 0.7 + COALESCE(nt.threat_confidence, 0)::numeric * 100 * 0.3)
      END,
      0
    )`;
}

/**
 * Build the threat-level SQL CASE expression.
 *
 * Thresholds: ≥80 CRITICAL, ≥60 HIGH, ≥40 MED, ≥20 LOW, else NONE.
 *
 * @param scoreExpr  The threat-score SQL sub-expression (from buildThreatScoreExpr).
 */
export function buildThreatLevelExpr(scoreExpr: string): string {
  return `CASE
      WHEN nt.threat_tag = 'FALSE_POSITIVE' THEN 'NONE'
      WHEN nt.threat_tag = 'INVESTIGATE' THEN COALESCE(nts.final_threat_level, 'NONE')
      ELSE (
        CASE
          WHEN ${scoreExpr} >= 80 THEN 'CRITICAL'
          WHEN ${scoreExpr} >= 60 THEN 'HIGH'
          WHEN ${scoreExpr} >= 40 THEN 'MED'
          WHEN ${scoreExpr} >= 20 THEN 'LOW'
          ELSE 'NONE'
        END
      )
    END`;
}
