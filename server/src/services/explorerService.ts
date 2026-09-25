/**
 * Explorer Service Layer
 * Encapsulates database queries for explorer operations
 */

const { query } = require('../config/database');
import { buildExplorerV2Query, buildLegacyExplorerQuery } from './explorerQueries';

export async function checkHomeLocationForFilters(enabled: any): Promise<boolean> {
  if (!enabled?.distanceFromHomeMin && !enabled?.distanceFromHomeMax) {
    return true;
  }
  try {
    const home = await query(
      "SELECT 1 FROM app.location_markers WHERE marker_type = 'home' LIMIT 1"
    );
    return home.rowCount > 0;
  } catch (err: any) {
    if (err && err.code === '42P01') {
      throw new (Error as any)('Home location markers table is missing (app.location_markers).', {
        cause: err,
      });
    }
    throw err;
  }
}

export async function executeExplorerQuery(sql: string, params: any[]): Promise<any> {
  const result = await query(sql, params);
  return result;
}

/**
 * Legacy paginated network list with optional search, quality filter and sort.
 * Joins latest/aggregated observations with networks and computes ST_Distance from home.
 */
export async function listNetworks(opts: {
  homeLon: number | null;
  homeLat: number | null;
  search: string;
  sort: string;
  order: 'ASC' | 'DESC';
  qualityWhere: string;
  limit: number | null;
  offset: number;
}): Promise<{ total: number; rows: any[] }> {
  const { sql, params } = buildLegacyExplorerQuery(opts);
  const result = await query(sql, params);
  return { total: result.rows[0]?.total || 0, rows: result.rows };
}

/**
 * Forensic-grade network list using the api_network_explorer_mv materialized view.
 * Supports complex multi-column sorting including threat level CASE ordering.
 */
export async function listNetworksV2(opts: {
  search: string;
  sort: string;
  order: string;
  limit: number | null;
  offset: number;
}): Promise<{ total: number; rows: any[] }> {
  const { sql, params } = buildExplorerV2Query(opts);
  const result = await query(sql, params);
  return { total: result.rows[0]?.total || 0, rows: result.rows };
}

/**
 * Fetch the full MV record for a single network by BSSID.
 * Falls back to a rich base-table query (same field set as the MV) when the
 * MV is stale and has no row — e.g. immediately after an import before the
 * nightly REFRESH runs.
 * Used by the platinum tooltip: click → fetch → full forensic card.
 */
export async function getNetworkByBssid(bssid: string): Promise<any | null> {
  const mvResult = await query(
    'SELECT * FROM app.api_network_explorer_mv WHERE UPPER(bssid) = UPPER($1) LIMIT 1',
    [bssid]
  );
  if (mvResult.rows[0]) {
    return mvResult.rows[0];
  }

  // MV stale — compute the same fields live for this single BSSID.
  // Cheap because every join is filtered to one bssid via index.
  const fallback = await query(
    `WITH best_obs AS (
       SELECT DISTINCT ON (o.bssid)
         o.bssid, o.lat, o.lon
       FROM app.observations o
       WHERE UPPER(o.bssid) = UPPER($1)
         AND o.lat IS NOT NULL AND o.lon IS NOT NULL
         AND (o.is_quality_filtered = false OR o.is_quality_filtered IS NULL)
       ORDER BY o.bssid, o.accuracy ASC NULLS LAST
     )
     SELECT
       n.bssid,
       n.ssid,
       n.type,
       n.frequency,
       n.bestlevel                                                    AS signal,
       bo.lat,
       bo.lon,
       nloc.centroid_lat,
       nloc.centroid_lon,
       nloc.weighted_lat,
       nloc.weighted_lon,
       gc.address                                                     AS geocoded_address,
       gc.city                                                        AS geocoded_city,
       gc.state                                                       AS geocoded_state,
       gc.postal_code                                                 AS geocoded_postal_code,
       gc.country                                                     AS geocoded_country,
       gc.poi_name                                                    AS geocoded_poi_name,
       gc.poi_category                                                AS geocoded_poi_category,
       gc.feature_type                                                AS geocoded_feature_type,
       gc.provider                                                    AS geocoded_provider,
       gc.confidence                                                  AS geocoded_confidence,
       to_timestamp((n.lasttime_ms::numeric / 1000.0)::double precision) AS observed_at,
       n.capabilities,
       CASE
         WHEN n.type = 'E'                                                                                                                      THEN 'BLE'
         WHEN n.type = 'B'                                                                                                                      THEN 'BT'
         WHEN n.capabilities ~ ';10$'                                                                                                           THEN 'BLE'
         WHEN UPPER(n.capabilities) IN ('MISC', 'UNCATEGORIZED')                                                                               THEN 'BT'
         WHEN COALESCE(n.capabilities,'') = ''                                                                                                  THEN 'OPEN'
         WHEN UPPER(n.capabilities) LIKE '%WEP%'                                                                                               THEN 'WEP'
         WHEN UPPER(n.capabilities) ~ '^\\s*\\[ESS\\]\\s*$'                                                                                        THEN 'OPEN'
         WHEN UPPER(n.capabilities) ~ '^\\s*\\[IBSS\\]\\s*$'                                                                                       THEN 'OPEN'
         WHEN UPPER(n.capabilities) ~ 'RSN-OWE'                                                                                                THEN 'WPA3-OWE'
         WHEN UPPER(n.capabilities) ~ 'RSN-SAE'                                                                                                THEN 'WPA3-P'
         WHEN UPPER(n.capabilities) ~ '(WPA3|SAE)' AND UPPER(n.capabilities) ~ '(EAP|MGT)'                                                    THEN 'WPA3-E'
         WHEN UPPER(n.capabilities) ~ '(WPA3|SAE)'                                                                                             THEN 'WPA3'
         WHEN UPPER(n.capabilities) ~ '(WPA2|RSN)' AND UPPER(n.capabilities) ~ '(EAP|MGT)'                                                    THEN 'WPA2-E'
         WHEN UPPER(n.capabilities) ~ '(WPA2|RSN)'                                                                                             THEN 'WPA2'
         WHEN UPPER(n.capabilities) ~ 'WPA-' AND UPPER(n.capabilities) NOT LIKE '%WPA2%'                                                       THEN 'WPA'
         WHEN UPPER(n.capabilities) LIKE '%WPA%' AND UPPER(n.capabilities) NOT LIKE '%WPA2%' AND UPPER(n.capabilities) NOT LIKE '%WPA3%' AND UPPER(n.capabilities) NOT LIKE '%RSN%' THEN 'WPA'
         WHEN UPPER(n.capabilities) LIKE '%WPS%' AND UPPER(n.capabilities) NOT LIKE '%WPA%' AND UPPER(n.capabilities) NOT LIKE '%RSN%'         THEN 'WPS'
         WHEN UPPER(n.capabilities) ~ '(CCMP|TKIP|AES)'                                                                                        THEN 'WPA2'
         ELSE 'UNKNOWN'
       END                                                            AS security,
       COALESCE(w3.wigle_v3_observation_count, n.wigle_v3_observation_count, 0) AS wigle_v3_observation_count,
       COALESCE(w3.wigle_v3_last_import_at, n.wigle_v3_last_import_at)          AS wigle_v3_last_import_at,
       COALESCE(t.threat_tag, 'untagged')                            AS tag_type,
       COALESCE(t.is_ignored, FALSE)                                 AS is_ignored,
       COUNT(o.id)                                                    AS observations,
       COUNT(DISTINCT date(o.time))                                   AS unique_days,
       COUNT(DISTINCT (round(o.lat::numeric,3)||','||round(o.lon::numeric,3))) AS unique_locations,
       MAX(o.accuracy)                                                AS accuracy_meters,
       MIN(o.time)                                                    AS first_seen,
       MAX(o.time)                                                    AS last_seen,
       CASE WHEN COALESCE(t.is_ignored,FALSE) THEN 0::numeric
            ELSE COALESCE(ts.final_threat_score, 0::numeric) END     AS threat_score,
       CASE WHEN COALESCE(t.is_ignored,FALSE) THEN 'NONE'
            ELSE COALESCE(ts.final_threat_level,'NONE') END          AS threat_level,
       COALESCE(ts.rule_based_score, 0::numeric)                     AS rule_based_score,
       COALESCE(ts.ml_threat_score, 0::numeric)                      AS ml_threat_score,
       COALESCE((ts.ml_feature_values->>'evidence_weight')::numeric, 0) AS ml_weight,
       COALESCE((ts.ml_feature_values->>'ml_boost')::numeric, 0)     AS ml_boost,
       ts.model_version,
       COALESCE(
         public.st_distance(
           public.st_setsrid(public.st_makepoint(
             COALESCE(nloc.weighted_lon, nloc.centroid_lon, bo.lon),
             COALESCE(nloc.weighted_lat, nloc.centroid_lat, bo.lat)
           ), 4326)::public.geography,
           (SELECT public.st_setsrid(public.st_makepoint(lm.longitude, lm.latitude), 4326)::public.geography
            FROM app.location_markers lm WHERE lm.marker_type = 'home' LIMIT 1)
         ) / 1000.0, 0
       )                                                              AS distance_from_home_km,
       rm.manufacturer,
       NULL::numeric                                                  AS stationary_confidence,
       NULL::numeric                                                  AS max_distance_meters
     FROM app.networks n
     LEFT JOIN app.network_tags t        ON n.bssid = t.bssid::text
     LEFT JOIN app.observations o        ON n.bssid = o.bssid
                                        AND o.lat IS NOT NULL AND o.lon IS NOT NULL
                                        AND (o.is_quality_filtered = false OR o.is_quality_filtered IS NULL)
     LEFT JOIN app.network_threat_scores ts ON n.bssid = ts.bssid::text
     LEFT JOIN best_obs bo               ON n.bssid = bo.bssid
     LEFT JOIN app.network_locations nloc ON UPPER(nloc.bssid) = UPPER(n.bssid)
     LEFT JOIN app.geocoding_cache gc    ON gc.precision = 4
                                        AND bo.lat IS NOT NULL AND bo.lon IS NOT NULL
                                        AND gc.lat_round = round(bo.lat::numeric, 4)
                                        AND gc.lon_round = round(bo.lon::numeric, 4)
     LEFT JOIN (
       SELECT netid,
              COUNT(*)::integer                                       AS wigle_v3_observation_count,
              MAX(COALESCE(last_update, observed_at, imported_at))   AS wigle_v3_last_import_at
       FROM app.wigle_v3_observations
       WHERE UPPER(netid) = UPPER($1)
       GROUP BY netid
     ) w3 ON UPPER(n.bssid) = UPPER(w3.netid)
     LEFT JOIN app.radio_manufacturers rm
       ON UPPER(REPLACE(SUBSTRING(n.bssid,1,8),':','')) = rm.prefix
     WHERE UPPER(n.bssid) = UPPER($1)
     GROUP BY
       n.bssid, n.ssid, n.type, n.frequency, n.bestlevel, n.lasttime_ms,
       n.capabilities, n.wigle_v3_observation_count, n.wigle_v3_last_import_at,
       w3.wigle_v3_observation_count, w3.wigle_v3_last_import_at,
       t.threat_tag, t.is_ignored,
       ts.final_threat_score, ts.final_threat_level, ts.rule_based_score,
       ts.ml_threat_score, ts.ml_feature_values, ts.model_version,
       rm.manufacturer, bo.lat, bo.lon,
       nloc.centroid_lat, nloc.centroid_lon, nloc.weighted_lat, nloc.weighted_lon,
       gc.address, gc.city, gc.state, gc.postal_code, gc.country,
       gc.poi_name, gc.poi_category, gc.feature_type, gc.provider, gc.confidence
     LIMIT 1`,
    [bssid]
  );
  return fallback.rows[0] ?? null;
}

module.exports = {
  checkHomeLocationForFilters,
  executeExplorerQuery,
  listNetworks,
  listNetworksV2,
  getNetworkByBssid,
};
