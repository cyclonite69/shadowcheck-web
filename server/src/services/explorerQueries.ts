export {};

import { buildExplorerV2OrderClause, resolveLegacySortColumn } from './explorerSorting';

const buildLegacyExplorerQuery = (opts: {
  homeLon: number | null;
  homeLat: number | null;
  search: string;
  sort: string;
  order: 'ASC' | 'DESC';
  qualityWhere: string;
  limit: number | null;
  offset: number;
}): { sql: string; params: any[] } => {
  const { homeLon, homeLat, search, sort, order, qualityWhere, limit, offset } = opts;
  const sortColumn = resolveLegacySortColumn(sort);

  const params: any[] = [homeLon, homeLat];
  const where: string[] = [];
  if (search) {
    params.push(`%${search}%`, `%${search}%`);
    where.push(
      `(COALESCE(NULLIF(obs.ssid, ''), NULLIF(n.ssid, '')) ILIKE $${params.length - 1} OR n.bssid ILIKE $${params.length})`
    );
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const orderClause = `ORDER BY ${sortColumn} ${order}`;
  let limitClause = '';
  if (limit !== null) {
    const limitIndex = params.length + 1;
    const offsetIndex = params.length + 2;
    params.push(limit, offset);
    limitClause = `LIMIT $${limitIndex} OFFSET $${offsetIndex}`;
  }

  const sql = `
    WITH obs_latest AS (
      SELECT DISTINCT ON (bssid)
        bssid,
        ssid,
        lat,
        lon,
        level,
        accuracy AS accuracy_meters,
        time AS observed_at,
        radio_type,
        radio_frequency,
        radio_capabilities
      FROM app.observations
      WHERE lat IS NOT NULL AND lon IS NOT NULL AND lat != 0 AND lon != 0 ${qualityWhere}
      ORDER BY bssid, time DESC
    ),
    obs_stats AS (
      SELECT
        bssid,
        COUNT(*) AS observations,
        MIN(observed_at) AS first_seen,
        MAX(observed_at) AS last_seen,
        BOOL_OR(radio_frequency BETWEEN 5000 AND 5924) AS is_5ghz,
        BOOL_OR(radio_frequency >= 5925) AS is_6ghz,
        BOOL_AND(COALESCE(NULLIF(ssid, ''), '') = '') AS is_hidden
      FROM app.observations
      GROUP BY bssid
    )
    SELECT
      n.bssid,
      COALESCE(NULLIF(obs.ssid, ''), NULLIF(n.ssid, '')) AS ssid,
      obs.observed_at,
      obs.level,
      obs.lat,
      obs.lon,
      COALESCE(stats.observations, 0) AS observations,
      stats.first_seen,
      stats.last_seen,
      COALESCE(stats.is_5ghz, false) AS is_5ghz,
      COALESCE(stats.is_6ghz, false) AS is_6ghz,
      COALESCE(stats.is_hidden, COALESCE(NULLIF(n.ssid, ''), '') = '') AS is_hidden,
      obs.radio_frequency AS frequency,
      obs.radio_capabilities AS capabilities,
      obs.accuracy_meters,
      obs.radio_type AS type,
      CASE
        WHEN obs.lat IS NOT NULL AND obs.lon IS NOT NULL THEN
          ST_Distance(
            ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
            ST_SetSRID(ST_MakePoint(obs.lon, obs.lat), 4326)::geography
          ) / 1000.0
        ELSE NULL
      END AS distance_from_home_km,
      COUNT(*) OVER() AS total
    FROM app.networks n
    LEFT JOIN obs_latest obs ON obs.bssid = n.bssid
    LEFT JOIN obs_stats stats ON stats.bssid = n.bssid
    ${whereClause}
    ${orderClause}
    ${limitClause}
  `;

  return { sql, params };
};

const buildExplorerV2Query = (opts: {
  search: string;
  sort: string;
  order: string;
  limit: number | null;
  offset: number;
}): { sql: string; params: any[] } => {
  const { search, sort, order, limit, offset } = opts;
  const orderByClauses = buildExplorerV2OrderClause(sort, order);

  const params: any[] = [];
  const where: string[] = [];
  if (search) {
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    where.push(
      `(ssid ILIKE $${params.length - 3}
        OR bssid ILIKE $${params.length - 2}
        OR manufacturer ILIKE $${params.length - 1}
        OR manufacturer_address ILIKE $${params.length})`
    );
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const orderClause = `ORDER BY ${orderByClauses}`;
  const distanceExpr = `
    CASE
      WHEN home.home_geog IS NULL THEN NULL
      WHEN mv.weighted_lat IS NOT NULL AND mv.weighted_lon IS NOT NULL THEN
        ST_Distance(
          ST_SetSRID(ST_MakePoint(mv.weighted_lon, mv.weighted_lat), 4326)::geography,
          home.home_geog
        ) / 1000.0
      WHEN mv.centroid_lat IS NOT NULL AND mv.centroid_lon IS NOT NULL THEN
        ST_Distance(
          ST_SetSRID(ST_MakePoint(mv.centroid_lon, mv.centroid_lat), 4326)::geography,
          home.home_geog
        ) / 1000.0
      WHEN mv.lat IS NOT NULL AND mv.lon IS NOT NULL THEN
        ST_Distance(
          ST_SetSRID(ST_MakePoint(mv.lon, mv.lat), 4326)::geography,
          home.home_geog
        ) / 1000.0
      ELSE NULL
    END
  `;

  const sql = `
    WITH home_location AS (
      SELECT ST_SetSRID(ST_MakePoint(lm.longitude, lm.latitude), 4326)::geography AS home_geog
      FROM app.location_markers lm
      WHERE lm.marker_type = 'home'
      LIMIT 1
    )
    SELECT
      mv.bssid,
      mv.ssid,
      mv.observed_at,
      mv.signal,
      mv.lat,
      mv.lon,
      mv.observations,
      mv.first_seen,
      mv.last_seen,
      mv.is_5ghz,
      mv.is_6ghz,
      mv.is_hidden,
      mv.type,
      mv.frequency,
      mv.capabilities,
      mv.security,
      ${distanceExpr} AS distance_from_home_km,
      mv.accuracy_meters,
      mv.manufacturer,
      mv.manufacturer_address,
      mv.min_altitude_m,
      mv.max_altitude_m,
      mv.altitude_span_m,
      mv.max_distance_meters,
      mv.last_altitude_m,
      mv.is_sentinel,
      COALESCE(
        jsonb_build_object(
          'score', live_ts.final_threat_score,
          'level', live_ts.final_threat_level,
          'model_version', live_ts.model_version
        ),
        mv.threat
      ) AS threat,
      COUNT(*) OVER() AS total
    FROM app.api_network_explorer_mv mv
    LEFT JOIN home_location home ON TRUE
    LEFT JOIN app.network_threat_scores live_ts ON mv.bssid = live_ts.bssid::text
    ${whereClause}
    ${orderClause}
    ${limit !== null ? `LIMIT $${params.length + 1} OFFSET $${params.length + 2}` : ''};
  `;

  if (limit !== null) {
    params.push(limit, offset);
  }

  return { sql, params };
};

export { buildExplorerV2Query, buildLegacyExplorerQuery };
