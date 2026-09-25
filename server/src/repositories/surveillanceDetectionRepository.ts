import {
  BULK_UPSERT_DETECTIONS_SQL,
  buildBulkUpsertDetectionParams,
  ENRICHED_CANDIDATES_SQL,
} from './surveillanceDetectionRepositorySql';

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

module.exports = { getEnrichedCandidates, bulkUpsertDetections };
export { getEnrichedCandidates, bulkUpsertDetections };
export type { CandidateRow as CandidateRowType, ScoredDetection as ScoredDetectionType };
