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

const buildWigleV2CountQuery = (
  whereClauses: string[],
  queryParams: any[]
): SqlQuery => ({
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
      obs.netid, obs.ssid, obs.encryption, obs.latitude, obs.longitude, obs.observed_at,
      ne.threat_score, ne.threat_level, ne.manufacturer,
      CASE WHEN ne.bssid IS NOT NULL
        THEN ne.geocoded_address
        ELSE gc.address
      END as geocoded_address,
      CASE WHEN ne.bssid IS NOT NULL
        THEN ne.geocoded_city
        ELSE gc.city
      END as geocoded_city,
      CASE WHEN ne.bssid IS NOT NULL
        THEN ne.geocoded_state
        ELSE gc.state
      END as geocoded_state,
      CASE WHEN ne.bssid IS NOT NULL
        THEN ne.geocoded_poi_name
        ELSE gc.poi_name
      END as geocoded_poi_name,
      ne.observations AS local_observations,
      ne.first_seen AS local_first_seen,
      ne.last_seen AS local_last_seen,
      (ne.bssid IS NOT NULL) AS wigle_match
    FROM app.wigle_v3_observations obs
    LEFT JOIN app.api_network_explorer_mv ne ON UPPER(ne.bssid) = UPPER(obs.netid)
    LEFT JOIN app.geocoding_cache gc ON gc.precision = 4
      AND gc.lat_round = ROUND(obs.latitude::numeric, 4)
      AND gc.lon_round = ROUND(obs.longitude::numeric, 4)
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

export {
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
};
