const { query } = require('../config/database');

import type {
  ThreatBehavioralCandidate,
  ThreatBehavioralScoreInput,
  ThreatDetailedThreatRecord,
  ThreatLevel,
  ThreatQuickThreatPageRecord,
  ThreatQuickThreatRecord,
  ThreatQuickThreatsQuery,
  ThreatRuleBasedBatchResult,
  ThreatRuleBasedFlags,
  ThreatScoringBatchRequest,
  ThreatScoringRepository,
} from '../services/threatScoring.types';

type QueryResult<T> = {
  rowCount: number | null;
  rows: T[];
};

type ThreatRuleBasedUpsertRow = {
  bssid: string;
};

type ThreatQuickThreatDbRow = {
  bssid: string | null;
  ssid: string | null;
  radio_type: string | null;
  channel: number | null;
  signal_dbm: number | null;
  encryption: string | null;
  latitude: number | null;
  longitude: number | null;
  first_seen: unknown;
  last_seen: unknown;
  observations: string | number | null;
  unique_days: string | number | null;
  unique_locations: string | number | null;
  distance_range_km: string | number | null;
  threat_score: string | number | null;
  threat_level: string | null;
  total_count: string | number | null;
};

type ThreatDetailedThreatDbRow = {
  bssid: string | null;
  ssid: string | null;
  type: string | null;
  encryption: string | null;
  frequency: number | null;
  signal_dbm: number | null;
  network_latitude: number | null;
  network_longitude: number | null;
  total_observations: string | number | null;
  final_threat_score: string | number | null;
  final_threat_level: string | null;
  rule_based_flags: ThreatRuleBasedFlags | null;
};

type ThreatBehavioralCandidateDbRow = {
  bssid: string;
  observation_count: string | number | null;
  unique_days: string | number | null;
  max_distance_km: string | number | null;
};

type ThreatRepositoryDeps = {
  query: <T>(sql: string, params?: unknown[]) => Promise<QueryResult<T>>;
};

const QUICK_THREATS_SQL = `
  SELECT
    ne.bssid,
    ne.ssid,
    ne.type as radio_type,
    ne.frequency as channel,
    ne.signal as signal_dbm,
    ne.security as encryption,
    ne.lat as latitude,
    ne.lon as longitude,
    ne.observations,
    ne.unique_days,
    ne.unique_locations,
    ne.first_seen,
    ne.last_seen,
    (ne.max_distance_meters / 1000.0) as distance_range_km,
    COALESCE(nts.final_threat_score, 0) as threat_score,
    COALESCE(nts.final_threat_level, 'NONE') as threat_level,
    COUNT(*) OVER() as total_count
  FROM app.api_network_explorer_mv ne
  LEFT JOIN app.network_threat_scores nts ON nts.bssid = ne.bssid
  WHERE ne.last_seen >= to_timestamp($1 / 1000.0)
    AND ne.observations >= $4
    AND ne.unique_days >= $5
    AND ne.unique_locations >= $6
    AND (ne.max_distance_meters / 1000.0) >= $7
    AND COALESCE(nts.final_threat_score, 0) >= $8
    AND (ne.type NOT IN ('L', 'N', 'G') OR ne.max_distance_meters > 50000)
  ORDER BY COALESCE(nts.final_threat_score, 0) DESC
  LIMIT $2 OFFSET $3
`;

const DETAILED_THREATS_SQL = `
  SELECT
    ne.bssid,
    ne.ssid,
    ne.type,
    ne.security as encryption,
    ne.frequency,
    ne.signal as signal_dbm,
    ne.lat as network_latitude,
    ne.lon as network_longitude,
    ne.observations as total_observations,
    nts.final_threat_score,
    nts.final_threat_level,
    nts.rule_based_flags
  FROM app.api_network_explorer_mv ne
  LEFT JOIN app.network_threat_scores nts ON nts.bssid = ne.bssid
  WHERE COALESCE(nts.final_threat_score, 0) >= 30
    AND (
      ne.type NOT IN ('G', 'L', 'N')
      OR ne.max_distance_meters > 5000
    )
  ORDER BY COALESCE(nts.final_threat_score, 0) DESC, ne.observations DESC
`;

const toInteger = (value: string | number | null | undefined): number => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? Math.trunc(value) : 0;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  return 0;
};

const toNumber = (value: string | number | null | undefined): number => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number.parseFloat(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  return 0;
};

const toNullableNumber = (value: string | number | null | undefined): number | null => {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = toNumber(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toThreatLevel = (value: string | null | undefined): ThreatLevel => {
  const normalized = String(value || 'NONE').toUpperCase();
  if (normalized === 'MED') {
    return 'MEDIUM';
  }
  if (
    normalized === 'CRITICAL' ||
    normalized === 'HIGH' ||
    normalized === 'MEDIUM' ||
    normalized === 'LOW' ||
    normalized === 'NONE'
  ) {
    return normalized;
  }
  return 'NONE';
};

const toRuleBasedFlags = (value: ThreatRuleBasedFlags | null | undefined): ThreatRuleBasedFlags => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value;
};

const mapQuickThreatRow = (row: ThreatQuickThreatDbRow): ThreatQuickThreatRecord => ({
  bssid: row.bssid,
  ssid: row.ssid,
  radioType: row.radio_type,
  channel: row.channel,
  signalDbm: row.signal_dbm,
  encryption: row.encryption,
  latitude: row.latitude,
  longitude: row.longitude,
  firstSeen: row.first_seen,
  lastSeen: row.last_seen,
  observations: toInteger(row.observations),
  uniqueDays: toInteger(row.unique_days),
  uniqueLocations: toInteger(row.unique_locations),
  distanceRangeKm: toNullableNumber(row.distance_range_km),
  threatScore: toNumber(row.threat_score),
  threatLevel: toThreatLevel(row.threat_level),
});

const mapDetailedThreatRow = (row: ThreatDetailedThreatDbRow): ThreatDetailedThreatRecord => ({
  bssid: row.bssid,
  ssid: row.ssid,
  type: row.type,
  encryption: row.encryption,
  frequency: row.frequency,
  signalDbm: row.signal_dbm,
  latitude: row.network_latitude,
  longitude: row.network_longitude,
  totalObservations: toInteger(row.total_observations),
  finalThreatScore: toNumber(row.final_threat_score),
  finalThreatLevel: toThreatLevel(row.final_threat_level),
  ruleBasedFlags: toRuleBasedFlags(row.rule_based_flags),
});

const mapBehavioralCandidateRow = (
  row: ThreatBehavioralCandidateDbRow
): ThreatBehavioralCandidate => ({
  bssid: row.bssid,
  observationCount: toInteger(row.observation_count),
  uniqueDays: toInteger(row.unique_days),
  maxDistanceKm: toNumber(row.max_distance_km),
});

const createThreatRepository = (
  deps: ThreatRepositoryDeps = { query }
): ThreatScoringRepository => ({
  async upsertRuleBasedThreatScores(
    request: ThreatScoringBatchRequest
  ): Promise<ThreatRuleBasedBatchResult> {
    const result = await deps.query<ThreatRuleBasedUpsertRow>(
      `
        WITH targets AS (
          SELECT n.bssid
          FROM app.networks n
          WHERE n.bssid IS NOT NULL
          ORDER BY n.bssid
          LIMIT $1
        ),
        scored AS (
          SELECT
            t.bssid,
            calculate_threat_score_v5(t.bssid) AS details
          FROM targets t
        )
        INSERT INTO app.network_threat_scores
          (bssid, rule_based_score, rule_based_flags, model_version, scored_at)
        SELECT
          bssid,
          (details->>'total_score')::numeric,
          details->'components',
          details->>'model_version',
          NOW()
        FROM scored
        ON CONFLICT (bssid) DO UPDATE SET
          rule_based_score = EXCLUDED.rule_based_score,
          rule_based_flags = EXCLUDED.rule_based_flags,
          model_version = EXCLUDED.model_version,
          scored_at = NOW(),
          updated_at = NOW()
        RETURNING bssid
      `,
      [request.batchSize]
    );

    const processedBssids = result.rows.map((row) => row.bssid);
    return {
      processedBssids,
      processedCount: processedBssids.length,
    };
  },

  async getBehavioralScoringCandidatesByBssids(params: {
    bssids: string[];
    minObservations: number;
    maxBssidLength: number;
  }): Promise<ThreatBehavioralCandidate[]> {
    if (params.bssids.length === 0) {
      return [];
    }

    const result = await deps.query<ThreatBehavioralCandidateDbRow>(
      `SELECT
         n.bssid,
         COUNT(DISTINCT obs.id) as observation_count,
         COUNT(DISTINCT DATE(obs.observed_at)) as unique_days,
         COALESCE(MAX(ABS(obs.lon - (-79.3832)) + ABS(obs.lat - 43.6532)) * 111, 0) as max_distance_km
       FROM app.networks n
       LEFT JOIN app.observations obs ON n.bssid = obs.bssid
       WHERE n.bssid = ANY($1)
         AND obs.id IS NOT NULL
         AND LENGTH(n.bssid) <= $2
         AND obs.lon IS NOT NULL
         AND obs.lat IS NOT NULL
       GROUP BY n.bssid
       HAVING COUNT(DISTINCT obs.id) > $3`,
      [params.bssids, params.maxBssidLength, params.minObservations]
    );

    return result.rows.map(mapBehavioralCandidateRow);
  },

  async upsertBehavioralThreatScores(scores: ThreatBehavioralScoreInput[]): Promise<number> {
    let updated = 0;

    for (const score of scores) {
      await deps.query(
        `INSERT INTO app.network_threat_scores
           (bssid, ml_threat_score, ml_threat_probability, ml_primary_class, model_version)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (bssid) DO UPDATE SET
           ml_threat_score = EXCLUDED.ml_threat_score,
           ml_threat_probability = EXCLUDED.ml_threat_probability,
           ml_primary_class = EXCLUDED.ml_primary_class,
           model_version = EXCLUDED.model_version,
           updated_at = NOW()`,
        [
          score.bssid,
          score.mlThreatScore,
          score.mlThreatProbability,
          score.mlPrimaryClass,
          score.modelVersion,
        ]
      );
      updated += 1;
    }

    return updated;
  },

  async getQuickThreats(queryParams: ThreatQuickThreatsQuery): Promise<ThreatQuickThreatPageRecord> {
    const result = await deps.query<ThreatQuickThreatDbRow>(QUICK_THREATS_SQL, [
      queryParams.minTimestamp,
      queryParams.limit,
      queryParams.offset,
      queryParams.minObservations,
      queryParams.minUniqueDays,
      queryParams.minUniqueLocations,
      queryParams.minRangeKm,
      queryParams.minThreatScore,
    ]);

    const totalCount = result.rows.length > 0 ? toInteger(result.rows[0].total_count) : 0;
    return {
      records: result.rows.map(mapQuickThreatRow),
      totalCount,
    };
  },

  async getDetailedThreats(): Promise<ThreatDetailedThreatRecord[]> {
    const result = await deps.query<ThreatDetailedThreatDbRow>(DETAILED_THREATS_SQL);
    return result.rows.map(mapDetailedThreatRow);
  },
});

const threatRepository = createThreatRepository();

module.exports = threatRepository;
module.exports.createThreatRepository = createThreatRepository;
export { createThreatRepository };
