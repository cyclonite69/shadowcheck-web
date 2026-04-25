export {};

type SqlQuery = {
  sql: string;
  queryParams: any[];
};

const buildWhereSql = (whereClauses: string[] = []): string =>
  whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

const buildPaginationSql = (
  queryParams: any[],
  limit: number | null,
  offset: number | null
): { allParams: any[]; paginationSql: string } => {
  const paginationClauses: string[] = [];
  const allParams = [...queryParams];

  if (limit !== null) {
    allParams.push(limit);
    paginationClauses.push(`LIMIT $${allParams.length}`);
  }
  if (offset !== null) {
    allParams.push(offset);
    paginationClauses.push(`OFFSET $${allParams.length}`);
  }

  return { allParams, paginationSql: paginationClauses.join(' ') };
};

const buildWigleSearchQuery = (params: {
  ssid?: string;
  bssid?: string;
  limit: number | null;
}): SqlQuery => {
  const queryParams: any[] = [];
  let sql: string;

  if (params.bssid) {
    sql = `SELECT bssid, ssid, encryption, trilat, trilong, lasttime
           FROM app.wigle_v2_networks_search WHERE bssid ILIKE $1 ORDER BY lasttime DESC`;
    queryParams.push(`%${params.bssid}%`);
  } else {
    sql = `SELECT bssid, ssid, encryption, trilat, trilong, lasttime
           FROM app.wigle_v2_networks_search WHERE ssid ILIKE $1 ORDER BY lasttime DESC`;
    queryParams.push(`%${params.ssid}%`);
  }

  if (params.limit !== null) {
    queryParams.push(params.limit);
    sql += ` LIMIT $${queryParams.length}`;
  }

  return { sql, queryParams };
};

const buildWigleV2NetworksQuery = (params: {
  limit: number | null;
  offset: number | null;
  whereClauses: string[];
  queryParams: any[];
}): SqlQuery => {
  const whereSql = buildWhereSql(params.whereClauses);
  const { allParams, paginationSql } = buildPaginationSql(
    params.queryParams,
    params.limit,
    params.offset
  );

  const sql = `SELECT bssid, ssid, encryption, trilat, trilong, firsttime, lasttime, type,
                      channel, frequency, qos, comment, source, region, city, road, housenumber
               FROM app.wigle_v2_networks_search ${whereSql} ORDER BY lasttime DESC ${paginationSql}`;
  return { sql, queryParams: allParams };
};

const buildWigleV2CountQuery = (whereClauses: string[], queryParams: any[]): SqlQuery => ({
  sql: `SELECT COUNT(*) as total FROM app.wigle_v2_networks_search ${buildWhereSql(whereClauses)}`,
  queryParams,
});

const buildWigleV3NetworksQuery = (params: {
  limit: number | null;
  offset: number | null;
  whereClauses?: string[];
  queryParams?: any[];
}): SqlQuery => {
  const whereSql = buildWhereSql(params.whereClauses || []);
  const { allParams, paginationSql } = buildPaginationSql(
    params.queryParams || [],
    params.limit,
    params.offset
  );

  const sql = `
    SELECT
      obs.netid,
      obs.ssid,
      obs.encryption,
      obs.latitude,
      obs.longitude,
      obs.observed_at,
      obs.frequency,
      obs.channel,
      obs.accuracy,
      obs.last_update,
      'wigle-v3'::text AS wigle_source
    FROM app.wigle_v3_observations obs
    ${whereSql}
    ORDER BY obs.observed_at DESC
    ${paginationSql}
  `;
  return { sql, queryParams: allParams };
};

const buildWigleV3CountQuery = (
  whereClauses: string[] = [],
  queryParams: any[] = []
): SqlQuery => ({
  sql: `SELECT COUNT(*) as total FROM app.wigle_v3_observations obs ${buildWhereSql(whereClauses)}`,
  queryParams,
});

const buildWigleObservationsQuery = (
  netid: string,
  limit?: number | null,
  offset?: number | null
): SqlQuery => {
  const queryParams: any[] = [netid];

  let sql = `SELECT id, netid, latitude, longitude, altitude, accuracy,
                    signal, observed_at, last_update, ssid,
                    frequency, channel, encryption, noise, snr, month
             FROM app.wigle_v3_observations
             WHERE netid = $1
             ORDER BY observed_at DESC`;

  if (limit !== null && limit !== undefined) {
    queryParams.push(limit);
    sql += ` LIMIT $${queryParams.length}`;
  }
  if (offset !== null && offset !== undefined) {
    queryParams.push(offset);
    sql += ` OFFSET $${queryParams.length}`;
  }

  return { sql, queryParams };
};

const buildWigleObservationsCountQuery = (netid: string): SqlQuery => ({
  sql: `SELECT COUNT(*) AS total FROM app.wigle_v3_observations WHERE netid = $1`,
  queryParams: [netid],
});

const buildWigleNetworkByBssidQuery = (bssid: string): SqlQuery => ({
  sql: `SELECT bssid, ssid, encryption, country, region, city, trilat, trilong,
               firsttime as first_seen, lasttime as last_seen
          FROM app.wigle_v2_networks_search
         WHERE bssid = $1
         ORDER BY lasttime DESC
         LIMIT 1`,
  queryParams: [bssid],
});

const buildWiglePageV3DetailQuery = (netid: string): SqlQuery => ({
  sql: `SELECT
          nd.netid,
          nd.ssid,
          nd.name,
          nd.type,
          nd.encryption,
          nd.channel,
          nd.qos,
          nd.last_update,
          nd.trilat,
          nd.trilon,
          nd.comment,
          rm.manufacturer AS oui_manufacturer
        FROM app.wigle_v3_network_details nd
        LEFT JOIN app.radio_manufacturers rm
          ON rm.bit_length = 24
          AND rm.prefix = UPPER(LEFT(REPLACE(nd.netid, ':', ''), 6))
        WHERE UPPER(nd.netid) = UPPER($1)
        LIMIT 1`,
  queryParams: [netid],
});

const buildWiglePageV2SummaryQuery = (netid: string): SqlQuery => ({
  sql: `SELECT
          v2.bssid,
          v2.ssid,
          v2.name,
          v2.type,
          v2.encryption,
          v2.channel,
          v2.frequency,
          v2.qos,
          v2.firsttime,
          v2.lasttime,
          v2.lastupdt,
          v2.trilat,
          v2.trilong,
          v2.comment,
          v2.source,
          v2.city,
          v2.region,
          v2.road,
          v2.housenumber,
          rm.manufacturer AS oui_manufacturer
        FROM app.wigle_v2_networks_search v2
        LEFT JOIN app.radio_manufacturers rm
          ON rm.bit_length = 24
          AND rm.prefix = UPPER(LEFT(REPLACE(v2.bssid, ':', ''), 6))
        WHERE UPPER(v2.bssid) = UPPER($1)
        ORDER BY v2.lasttime DESC NULLS LAST, v2.lastupdt DESC NULLS LAST
        LIMIT 1`,
  queryParams: [netid],
});

const buildWiglePageLocalMatchQuery = (netid: string): SqlQuery => ({
  sql: `SELECT
          (COUNT(*) > 0)::boolean AS has_local_match,
          COUNT(*)::int           AS local_observation_count,
          MIN(observed_at)::text  AS local_first_seen,
          MAX(observed_at)::text  AS local_last_seen
        FROM app.observations
        WHERE UPPER(bssid) = UPPER($1)`,
  queryParams: [netid],
});

const buildWiglePageV3TemporalQuery = (netid: string): SqlQuery => ({
  sql: `SELECT
          MIN(observed_at)::text                              AS wigle_v3_first_seen,
          MAX(observed_at)::text                             AS wigle_v3_last_seen,
          COUNT(*)::int                                      AS wigle_v3_observation_count,
          (COUNT(*)::int < 3)::boolean                      AS wigle_precision_warning,
          AVG(latitude)::float8                              AS wigle_v3_centroid_lat,
          AVG(longitude)::float8                             AS wigle_v3_centroid_lon,
          COUNT(DISTINCT NULLIF(TRIM(ssid), ''))::int        AS wigle_v3_ssid_variant_count,
          CASE
            WHEN COUNT(*) > 1 THEN
              ROUND(
                ST_Distance(
                  ST_MakePoint(MIN(longitude), MIN(latitude))::geography,
                  ST_MakePoint(MAX(longitude), MAX(latitude))::geography
                )::numeric,
                1
              )
            ELSE 0
          END::float8                                        AS wigle_v3_spread_m
        FROM app.wigle_v3_observations
        WHERE netid = $1`,
  queryParams: [netid],
});

const buildWigleNetworksMvQuery = (bssid: string): SqlQuery => ({
  sql: `SELECT
          bssid,
          ssid_display,
          network_name,
          network_type,
          encryption,
          channel,
          frequency,
          qos,
          comment,
          wigle_source,
          wigle_v2_firsttime,
          wigle_v2_lasttime,
          wigle_v2_lastupdt,
          wigle_v2_trilat_lat,
          wigle_v2_trilat_lon,
          wigle_v2_city,
          wigle_v2_region,
          wigle_v2_road,
          wigle_v2_housenumber,
          has_wigle_v2_record,
          wigle_v3_first_seen,
          wigle_v3_last_seen,
          wigle_v3_observation_count,
          wigle_v3_ssid_variant_count,
          has_wigle_v3_observations,
          wigle_v3_centroid_lat,
          wigle_v3_centroid_lon,
          wigle_v3_spread_m,
          display_lat,
          display_lon,
          display_coordinate_source,
          manufacturer,
          public_nonstationary_flag,
          public_ssid_variant_flag,
          wigle_precision_warning,
          has_local_match,
          local_observation_count,
          local_first_seen,
          local_last_seen
        FROM app.api_wigle_networks_mv
        WHERE bssid = UPPER($1)`,
  queryParams: [bssid],
});

const buildWigleV3TableExistsQuery = (): SqlQuery => ({
  sql: `SELECT EXISTS (
           SELECT FROM information_schema.tables
           WHERE table_schema = 'app' AND table_name = 'wigle_v3_observations'
         ) as exists`,
  queryParams: [],
});

const buildRecentWigleDetailImportQuery = (netid: string, withinHours: number): SqlQuery => ({
  sql: `SELECT *
          FROM app.wigle_v3_network_details
         WHERE netid = $1
           AND imported_at >= NOW() - ($2::int * INTERVAL '1 hour')
         ORDER BY imported_at DESC
         LIMIT 1`,
  queryParams: [netid, Math.floor(withinHours)],
});

const buildKmlPointsQuery = (params: {
  bssid?: string;
  limit?: number | null;
  offset?: number | null;
}): SqlQuery => {
  const { bssid, limit = null, offset = null } = params;
  const queryParams: any[] = [];
  const whereClauses = ['kp.location IS NOT NULL'];

  if (bssid) {
    queryParams.push(`${bssid}%`);
    whereClauses.push(`kp.bssid ILIKE $${queryParams.length}`);
  }

  const { allParams, paginationSql } = buildPaginationSql(queryParams, limit, null);
  const finalParams = [...allParams];
  const paginationClauses = [paginationSql];

  if (offset !== null && offset > 0) {
    finalParams.push(offset);
    paginationClauses.push(`OFFSET $${finalParams.length}`);
  }

  return {
    sql: `
      SELECT
        kp.id,
        kp.bssid,
        NULLIF(kp.name, '') AS ssid,
        kp.network_id,
        kp.name,
        kp.network_type,
        kp.observed_at,
        kp.accuracy_m,
        kp.signal_dbm,
        kf.source_file,
        kp.folder_name,
        ST_Y(kp.location) AS latitude,
        ST_X(kp.location) AS longitude
      FROM app.kml_points kp
      JOIN app.kml_files kf ON kf.id = kp.kml_file_id
      ${buildWhereSql(whereClauses)}
      ORDER BY kp.observed_at DESC NULLS LAST, kp.id DESC
      ${paginationClauses.filter(Boolean).join(' ')}
    `,
    queryParams: finalParams,
  };
};

const buildWiglePageMostRecentObsQuery = (netid: string): SqlQuery => ({
  sql: `SELECT ssid, channel, frequency, accuracy
          FROM app.wigle_v3_observations
         WHERE netid = $1
         ORDER BY observed_at DESC
         LIMIT 1`,
  queryParams: [netid],
});

const buildWiglePageGeocodedAddressQuery = (
  lat: number | null,
  lon: number | null,
  precision: number
): SqlQuery => ({
  sql: `SELECT address
          FROM app.geocoding_cache
         WHERE precision = $1
           AND lat_round = ROUND($2::numeric, $1)
           AND lon_round = ROUND($3::numeric, $1)
         LIMIT 1`,
  queryParams: [precision, lat ?? 0, lon ?? 0],
});

const buildKmlPointsCountQuery = (bssid?: string): SqlQuery => {
  const queryParams = bssid ? [`${bssid}%`] : [];
  const whereClauses = ['kp.location IS NOT NULL'];

  if (bssid) {
    whereClauses.push(`kp.bssid ILIKE $1`);
  }

  return {
    sql: `SELECT COUNT(*) AS total
            FROM app.kml_points kp
            ${buildWhereSql(whereClauses)}`,
    queryParams,
  };
};

// Zoom level → grid cell size in degrees.
// Coarser at low zoom (wide view), finer at high zoom (street level).
const ZOOM_GRID_SIZES: [number, number][] = [
  [7, 0.5],
  [9, 0.2],
  [11, 0.05],
  [13, 0.01],
  [Infinity, 0.005],
];

const gridSizeForZoom = (zoom: number): number => {
  for (const [maxZoom, size] of ZOOM_GRID_SIZES) {
    if (zoom <= maxZoom) return size;
  }
  return 0.005;
};

/**
 * @route GET /api/wigle/observations/aggregated
 * @description Builds a zoom-aware spatial aggregation query across one or more
 *   observation sources. Each source is snapped to a PostGIS grid whose cell size
 *   is derived from the map zoom level, producing centroid points with a count and
 *   optional average signal strength.
 * @param params.west - Western bbox longitude (-180..180)
 * @param params.south - Southern bbox latitude (-90..90)
 * @param params.east - Eastern bbox longitude (-180..180)
 * @param params.north - Northern bbox latitude (-90..90)
 * @param params.zoom - Mapbox zoom level (0–22); controls ST_SnapToGrid cell size
 * @param params.sources - Active source identifiers: 'field' | 'wigle-v2' | 'wigle-v3' | 'kml'
 * @returns SqlQuery returning rows: { lon, lat, count, avg_signal, source }
 */
const buildAggregatedObservationsQuery = (params: {
  west: number;
  south: number;
  east: number;
  north: number;
  zoom: number;
  sources: string[];
}): SqlQuery => {
  const gridSize = gridSizeForZoom(params.zoom);
  const queryParams: any[] = [params.west, params.south, params.east, params.north, gridSize];
  const bbox = `ST_MakeEnvelope($1, $2, $3, $4, 4326)`;

  const branches: string[] = [];

  if (params.sources.includes('field')) {
    branches.push(`
      SELECT ST_SnapToGrid(geom, $5) AS cell, COUNT(*)::integer AS n,
             AVG(level)::integer AS avg_signal, 'field'::text AS source
      FROM app.observations
      WHERE geom && ${bbox}
      GROUP BY 1`);
  }

  if (params.sources.includes('wigle-v2')) {
    branches.push(`
      SELECT ST_SnapToGrid(location, $5) AS cell, COUNT(*)::integer AS n,
             NULL::integer AS avg_signal, 'wigle-v2'::text AS source
      FROM app.wigle_v2_networks_search
      WHERE location && ${bbox}
      GROUP BY 1`);
  }

  if (params.sources.includes('wigle-v3')) {
    branches.push(`
      SELECT ST_SnapToGrid(location, $5) AS cell, COUNT(*)::integer AS n,
             AVG(signal)::integer AS avg_signal, 'wigle-v3'::text AS source
      FROM app.wigle_v3_observations
      WHERE location && ${bbox}
      GROUP BY 1`);
  }

  if (params.sources.includes('kml')) {
    branches.push(`
      SELECT ST_SnapToGrid(location, $5) AS cell, COUNT(*)::integer AS n,
             AVG(signal_dbm)::integer AS avg_signal, 'kml'::text AS source
      FROM app.kml_points
      WHERE location && ${bbox}
        AND location IS NOT NULL
      GROUP BY 1`);
  }

  const sql = `
    SELECT ST_X(cell) AS lon, ST_Y(cell) AS lat, n AS count, avg_signal, source
    FROM (
      ${branches.join('\n      UNION ALL\n')}
    ) cells
    ORDER BY n DESC`;

  return { sql, queryParams };
};

/**
 * @route GET /api/wigle/observations/extent
 * @description Builds a query that computes the ST_Extent bounding box for each
 *   active source independently (so spatial indexes are used), then takes the
 *   MIN/MAX across all source extents to return a single combined bbox.
 * @param sources - Active source identifiers: 'field' | 'wigle-v2' | 'wigle-v3' | 'kml'
 * @returns SqlQuery returning a single row: { west, south, east, north } or null if no data
 */
const buildObservationsExtentQuery = (sources: string[]): SqlQuery => {
  const branches: string[] = [];

  if (sources.includes('field')) {
    branches.push(`
      SELECT ST_XMin(ST_Extent(geom)) AS west, ST_YMin(ST_Extent(geom)) AS south,
             ST_XMax(ST_Extent(geom)) AS east, ST_YMax(ST_Extent(geom)) AS north
      FROM app.observations`);
  }
  if (sources.includes('wigle-v2')) {
    branches.push(`
      SELECT ST_XMin(ST_Extent(location)) AS west, ST_YMin(ST_Extent(location)) AS south,
             ST_XMax(ST_Extent(location)) AS east, ST_YMax(ST_Extent(location)) AS north
      FROM app.wigle_v2_networks_search WHERE location IS NOT NULL`);
  }
  if (sources.includes('wigle-v3')) {
    branches.push(`
      SELECT ST_XMin(ST_Extent(location)) AS west, ST_YMin(ST_Extent(location)) AS south,
             ST_XMax(ST_Extent(location)) AS east, ST_YMax(ST_Extent(location)) AS north
      FROM app.wigle_v3_observations WHERE location IS NOT NULL`);
  }
  if (sources.includes('kml')) {
    branches.push(`
      SELECT ST_XMin(ST_Extent(location)) AS west, ST_YMin(ST_Extent(location)) AS south,
             ST_XMax(ST_Extent(location)) AS east, ST_YMax(ST_Extent(location)) AS north
      FROM app.kml_points WHERE location IS NOT NULL`);
  }

  const sql = `
    SELECT MIN(west) AS west, MIN(south) AS south, MAX(east) AS east, MAX(north) AS north
    FROM (
      ${branches.join('\n      UNION ALL\n')}
    ) extents
    WHERE west IS NOT NULL`;

  return { sql, queryParams: [] };
};

export {
  buildWigleNetworksMvQuery,
  buildWiglePageGeocodedAddressQuery,
  buildWiglePageLocalMatchQuery,
  buildWiglePageMostRecentObsQuery,
  buildWiglePageV2SummaryQuery,
  buildWiglePageV3DetailQuery,
  buildWiglePageV3TemporalQuery,
  buildKmlPointsCountQuery,
  buildKmlPointsQuery,
  buildRecentWigleDetailImportQuery,
  buildWigleNetworkByBssidQuery,
  buildWigleObservationsQuery,
  buildWigleObservationsCountQuery,
  buildWigleSearchQuery,
  buildWigleV2CountQuery,
  buildWigleV2NetworksQuery,
  buildWigleV3TableExistsQuery,
  buildWigleV3CountQuery,
  buildWigleV3NetworksQuery,
  buildAggregatedObservationsQuery,
  buildObservationsExtentQuery,
};
