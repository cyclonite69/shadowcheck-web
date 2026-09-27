import {
  BULK_UPSERT_DETECTIONS_SQL,
  buildBulkUpsertDetectionParams,
  ENRICHED_CANDIDATES_SQL,
  GET_DETECTION_EVIDENCE_BY_BSSID_SQL,
} from './surveillanceDetectionRepositorySql';

export interface DetectionEvidenceRow {
  device_type: string;
  confidence: number;
  threat_score: number;
  detected_at: string;
  lastupdt: string | null;
  detection_method: string;
  matched_signals: Record<string, any> | null;
  false_positive: boolean;
  fp_reason: string | null;
  notes: string | null;
  tags: string[] | null;
}

export interface CandidateRow {
  bssid: string;
  ssid: string | null;
  type: string;
  bestlevel: number | null;
  service: string | null;
  mfgrid: number | null;
  device_type: string;
  base_likelihood: number;
  match_quality: string;
  detection_method: string;
  matched_signals: Record<string, any>;
  priority: number;
  tier_hit_count: number;
  obs_count: number;
  unique_days: number;
  min_rssi: number | null;
  max_rssi: number | null;
  avg_rssi: number | null;
  first_seen: string | null;
  last_seen: string | null;
  duration_seconds: number;
  unique_positions: number;
}

export interface ScoredDetection {
  bssid: string;
  device_type: string;
  confidence: number;
  threat_score: number;
  detection_method: string;
  matched_signals: Record<string, any>;
  false_positive: boolean;
  fp_reason: string | null;
}

/**
 * Fetches enriched surveillance candidates with observation stats.
 * Returns ALL tier hits per bssid (not deduplicated) so the scoring
 * engine can evaluate multi-surface corroboration.
 */
async function getEnrichedCandidates(
  adminQuery: (sql: string, params?: any[]) => Promise<any>
): Promise<CandidateRow[]> {
  const result = await adminQuery(ENRICHED_CANDIDATES_SQL);

  return result.rows as CandidateRow[];
}

/**
 * Bulk upserts scored surveillance detections.
 * Returns the number of rows upserted.
 */
async function bulkUpsertDetections(
  adminQuery: (sql: string, params?: any[]) => Promise<any>,
  detections: ScoredDetection[]
): Promise<number> {
  if (detections.length === 0) {
    return 0;
  }

  const result = await adminQuery(
    BULK_UPSERT_DETECTIONS_SQL,
    buildBulkUpsertDetectionParams(detections)
  );

  return result.rowCount ?? 0;
}

/**
 * Retrieves surveillance detection evidence and associated tags for a specific BSSID.
 * Follows repository convention requiring an explicit query executor.
 *
 * @param queryExecutor - Database query function (e.g. query from config/database or adminQuery)
 * @param bssid - Normalized BSSID string
 */
async function getDetectionEvidenceByBssid(
  queryExecutor: (sql: string, params?: any[]) => Promise<any>,
  bssid: string
): Promise<DetectionEvidenceRow[]> {
  const result = await queryExecutor(GET_DETECTION_EVIDENCE_BY_BSSID_SQL, [bssid]);
  return result.rows as DetectionEvidenceRow[];
}

module.exports = { getEnrichedCandidates, bulkUpsertDetections, getDetectionEvidenceByBssid };
export { getEnrichedCandidates, bulkUpsertDetections, getDetectionEvidenceByBssid };
export type {
  CandidateRow as CandidateRowType,
  ScoredDetection as ScoredDetectionType,
  DetectionEvidenceRow as DetectionEvidenceRowType,
};
