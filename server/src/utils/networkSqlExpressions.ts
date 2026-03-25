/**
 * Shared SQL expression builders for network queries.
 *
 * Single source of truth for:
 *  - Network type classification          (buildTypeExpr)
 *  - Distance-from-home subquery          (buildDistanceExpr)
 *  - Security/encryption type predicates  (OPEN_PREDICATE, buildEncryptionTypeCondition)
 *  - Threat score / level CASE expressions (buildThreatScoreExpr, buildThreatLevelExpr)
 *
 * Used by:
 *  - server/src/api/routes/v1/networks/list.ts
 *  - server/src/services/networkService.ts
 */

export interface SqlCondition {
  sql: string;
  params: any[];
}

// ── Security predicates ────────────────────────────────────────────────────

/**
 * Regex pattern for recognised encryption keywords.
 */
const ENCRYPTION_KEYWORDS_REGEX = '(WPA|WEP|RSN|CCMP|TKIP|OWE|SAE)';

/**
 * SQL predicate that matches open / unencrypted networks.
 *
 * Rows match if security is NULL, empty, or contains no recognised
 * encryption keywords.  ESS / IBSS are infrastructure-mode flags, not
 * encryption markers, and are intentionally absent from the exclusion list.
 */
export function openPredicate(paramIndex: number): SqlCondition {
  return {
    sql: `(ne.security IS NULL OR ne.security = '' OR ne.security !~* $${paramIndex})`,
    params: [ENCRYPTION_KEYWORDS_REGEX],
  };
}

/**
 * Map a single canonical encryption type value to its SQL WHERE clause.
 *
 * @param enc         Canonical type (e.g. 'OPEN', 'WEP', 'WPA', 'WPA2', 'WPA3',
 *                    'OWE', 'SAE').
 * @param paramIndex  Current parameter index for $n placeholders.
 */
export function encryptionTypePredicate(enc: string, paramIndex: number): SqlCondition {
  switch (enc.toUpperCase()) {
    case 'OPEN':
    case 'NONE': // legacy alias
      return openPredicate(paramIndex);

    case 'WEP':
      return {
        sql: `ne.security ILIKE $${paramIndex}`,
        params: ['%WEP%'],
      };

    case 'WPA':
      // WPA v1 only — explicitly exclude WPA2/WPA3 and RSN/SAE rows
      return {
        sql: `(ne.security ILIKE $${paramIndex} AND ne.security NOT ILIKE $${paramIndex + 1} AND ne.security NOT ILIKE $${paramIndex + 2} AND ne.security !~* $${paramIndex + 3})`,
        params: ['%WPA%', '%WPA2%', '%WPA3%', '(RSN|SAE)'],
      };

    case 'WPA2':
      // WPA2 or RSN-tagged rows, excluding WPA3
      return {
        sql: `((ne.security ILIKE $${paramIndex} OR ne.security ~* $${paramIndex + 1}) AND ne.security NOT ILIKE $${paramIndex + 2})`,
        params: ['%WPA2%', 'RSN', '%WPA3%'],
      };

    case 'WPA3':
      // WPA3 or SAE (WPA3-Personal)
      return {
        sql: `(ne.security ILIKE $${paramIndex} OR ne.security ~* $${paramIndex + 1})`,
        params: ['%WPA3%', 'SAE'],
      };

    case 'OWE':
      return {
        sql: `ne.security ~* $${paramIndex}`,
        params: ['OWE'],
      };

    case 'SAE':
      return {
        sql: `ne.security ~* $${paramIndex}`,
        params: ['SAE'],
      };

    default:
      // Generic ILIKE fallback
      return {
        sql: `ne.security ILIKE $${paramIndex}`,
        params: [`%${enc}%`],
      };
  }
}

/**
 * Build a combined SQL WHERE condition for an `encryptionTypes` filter list.
 *
 * Returns null when the list is empty (caller should skip the clause).
 */
export function buildEncryptionTypeCondition(
  types: string[],
  paramIndex: number
): SqlCondition | null {
  if (!types || types.length === 0) {
    return null;
  }
  const params: any[] = [];
  let currentParamIndex = paramIndex;
  const clauses: string[] = [];

  for (const type of types) {
    const result = encryptionTypePredicate(type, currentParamIndex);
    clauses.push(result.sql);
    params.push(...result.params);
    currentParamIndex += result.params.length;
  }

  return {
    sql: `(${clauses.join(' OR ')})`,
    params,
  };
}

/**
 * Map a single canonical auth method value to its SQL WHERE clause.
 */
export function authMethodPredicate(auth: string, paramIndex: number): SqlCondition {
  if (auth.toUpperCase() === 'NONE') {
    return {
      sql: `(ne.auth IS NULL OR ne.auth = '' OR ne.auth ILIKE $${paramIndex})`,
      params: ['%NONE%'],
    };
  }
  return {
    sql: `ne.auth ILIKE $${paramIndex}`,
    params: [`%${auth}%`],
  };
}

/**
 * Build a combined SQL WHERE condition for an `authMethods` filter list.
 */
export function buildAuthMethodCondition(
  methods: string[],
  paramIndex: number
): SqlCondition | null {
  if (!methods || methods.length === 0) {
    return null;
  }
  const params: any[] = [];
  let currentParamIndex = paramIndex;
  const clauses: string[] = [];

  for (const method of methods) {
    const result = authMethodPredicate(method, currentParamIndex);
    clauses.push(result.sql);
    params.push(...result.params);
    currentParamIndex += result.params.length;
  }

  return {
    sql: `(${clauses.join(' OR ')})`,
    params,
  };
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
        WHEN nt.threat_tag = 'INVESTIGATE'    THEN COALESCE(nts.rule_based_score, 0)
        ELSE COALESCE(nts.rule_based_score, 0)
      END, 0)`;
  }

  return `COALESCE(
    CASE
      WHEN nt.threat_tag = 'FALSE_POSITIVE' THEN 0
      WHEN nt.threat_tag = 'INVESTIGATE'    THEN ne.threat_score
      ELSE ne.threat_score
    END, 0)`;
}

/**
 * Build the threat-level SQL CASE expression based on a score expression.
 */
export function buildThreatLevelExpr(scoreExpr: string): string {
  return `CASE
    WHEN nt.threat_tag = 'FALSE_POSITIVE' THEN 'NONE'
    WHEN (${scoreExpr}) >= 80 THEN 'CRITICAL'
    WHEN (${scoreExpr}) >= 60 THEN 'HIGH'
    WHEN (${scoreExpr}) >= 40 THEN 'MED'
    WHEN (${scoreExpr}) >= 20 THEN 'LOW'
    ELSE 'NONE'
  END`;
}

// ── Network type expressions ───────────────────────────────────────────────

/**
 * Build the SQL expression to canonicalise network type (W, E, L, N, G).
 *
 * Falls back to frequency-based inference or security-pattern matching
 * when the 'type' column is empty/null.
 */
export function buildTypeExpr(alias = 'ne'): string {
  return `CASE
    WHEN ${alias}.type IN ('WIFI', 'W') THEN 'W'
    WHEN ${alias}.type IN ('BLE', 'BT', 'E') THEN 'E'
    WHEN ${alias}.type IN ('LTE', '4G', 'L') THEN 'L'
    WHEN ${alias}.type IN ('NR', '5G', 'N') THEN 'N'
    WHEN ${alias}.type IN ('GSM', '2G', 'G') THEN 'G'
    WHEN ${alias}.frequency BETWEEN 2412 AND 7125 THEN 'W'
    WHEN ${alias}.capabilities ~* '(WPA|WEP|ESS|RSN)' THEN 'W'
    ELSE ${alias}.type
  END`;
}

// ── Distance-from-home expressions ──────────────────────────────────────────

/**
 * Build a subquery that calculates distance from home for each network.
 *
 * Note: Requires lat/lon to be passed as literals (checked/sanitised by caller).
 */
export function buildDistanceExpr(
  lat: number,
  lon: number,
  netAlias = 'ne',
  obsAlias = 'o'
): string {
  return `(
    SELECT ST_Distance(
      ST_MakePoint(${lon}, ${lat})::geography,
      ST_MakePoint(${obsAlias}.lon, ${obsAlias}.lat)::geography
    ) / 1000
    FROM app.observations ${obsAlias}
    WHERE ${obsAlias}.bssid = ${netAlias}.bssid
    ORDER BY ${obsAlias}.time DESC
    LIMIT 1
  )`;
}
