export {};

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
}): { sql: string; queryParams: any[] } => {
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
}): { sql: string; queryParams: any[] } => {
  const whereSql = buildWhereSql(params.whereClauses);
  const { allParams, paginationSql } = buildPaginationSql(
    params.queryParams,
    params.limit,
    params.offset
  );

  const sql = `SELECT bssid, ssid, encryption, trilat, trilong, lasttime, type
               FROM app.wigle_v2_networks_search ${whereSql} ORDER BY lasttime DESC ${paginationSql}`;
  return { sql, queryParams: allParams };
};

const buildWigleV2CountQuery = (
  whereClauses: string[],
  queryParams: any[]
): { sql: string; queryParams: any[] } => ({
  sql: `SELECT COUNT(*) as total FROM app.wigle_v2_networks_search ${buildWhereSql(whereClauses)}`,
  queryParams,
});

const buildWigleV3NetworksQuery = (params: {
  limit: number | null;
  offset: number | null;
  whereClauses?: string[];
  queryParams?: any[];
}): { sql: string; queryParams: any[] } => {
  const whereSql = buildWhereSql(params.whereClauses || []);
  const { allParams, paginationSql } = buildPaginationSql(
    params.queryParams || [],
    params.limit,
    params.offset
  );

  const sql = `SELECT netid, ssid, encryption, latitude, longitude, observed_at
              FROM app.wigle_v3_observations ${whereSql} ORDER BY observed_at DESC ${paginationSql}`;
  return { sql, queryParams: allParams };
};

const buildWigleV3CountQuery = (
  whereClauses: string[] = [],
  queryParams: any[] = []
): { sql: string; queryParams: any[] } => ({
  sql: `SELECT COUNT(*) as total FROM app.wigle_v3_observations ${buildWhereSql(whereClauses)}`,
  queryParams,
});

const buildWigleObservationsQuery = (
  netid: string,
  limit?: number | null,
  offset?: number | null
): { sql: string; queryParams: any[] } => {
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

export {
  buildWigleObservationsQuery,
  buildWigleSearchQuery,
  buildWigleV2CountQuery,
  buildWigleV2NetworksQuery,
  buildWigleV3CountQuery,
  buildWigleV3NetworksQuery,
};
