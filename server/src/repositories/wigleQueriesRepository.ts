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
          nd.first_seen,
          nd.last_seen,
          nd.last_update,
          nd.trilat,
          nd.trilon,
          nd.comment
        FROM app.wigle_v3_network_details nd
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
          v2.housenumber
        FROM app.wigle_v2_networks_search v2
        WHERE UPPER(v2.bssid) = UPPER($1)
        ORDER BY v2.lasttime DESC NULLS LAST, v2.lastupdt DESC NULLS LAST
        LIMIT 1`,
  queryParams: [netid],
});

const buildWiglePageLocalMatchQuery = (netid: string): SqlQuery => ({
  sql: `SELECT COUNT(*)::int AS local_observations
        FROM app.observations
        WHERE UPPER(bssid) = UPPER($1)`,
  queryParams: [netid],
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
  buildWiglePageLocalMatchQuery,
  buildWiglePageV2SummaryQuery,
  buildWiglePageV3DetailQuery,
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
