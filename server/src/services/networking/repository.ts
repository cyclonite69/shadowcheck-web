const { query } = require('../../config/database');

export {};

import { buildNetworkCountQuery, buildNetworkDataQuery } from './sql';

const getNetworkCount = async (
  conditions: string[],
  params: unknown[],
  joins: string[]
): Promise<number> => {
  const totalCountQuery = buildNetworkCountQuery(conditions, joins);

  const totalResult = await query(totalCountQuery, params);
  return parseInt(totalResult.rows[0]?.total || '0', 10);
};

const listNetworks = async (
  selectColumns: string[],
  joins: string[],
  conditions: string[],
  params: unknown[],
  sortClauses: string,
  limit: number,
  offset: number,
  paramIndex: number
): Promise<any[]> => {
  const dataQuery = buildNetworkDataQuery(
    selectColumns,
    joins,
    conditions,
    sortClauses,
    paramIndex
  );

  const dataParams = [...params, limit, offset];
  const dataResult = await query(dataQuery, dataParams);
  return dataResult.rows.map((row: any) => {
    const typedRow = { ...row };
    if (row.type === '?') {
      typedRow.type = null;
    }
    return typedRow;
  });
};

const explainQuery = async (
  selectColumns: string[],
  joins: string[],
  conditions: string[],
  params: unknown[],
  sortClauses: string,
  limit: number,
  offset: number,
  paramIndex: number
): Promise<any> => {
  const dataQuery = buildNetworkDataQuery(
    selectColumns,
    joins,
    conditions,
    sortClauses,
    paramIndex
  );

  const dataParams = [...params, limit, offset];
  const explained = await query(`EXPLAIN (FORMAT JSON) ${dataQuery}`, dataParams);
  return explained.rows;
};

const searchNetworksBySSID = async (
  searchPattern: string,
  limit?: number | null,
  offset?: number | null
): Promise<any[] | { rows: any[]; total: number }> => {
  const params: any[] = [searchPattern];
  let sql = `SELECT bssid, ssid, type, security AS encryption, signal,
                    last_seen AS lasttime, observations AS observation_count
             FROM app.api_network_explorer_mv
             WHERE ssid ILIKE $1
             ORDER BY observations DESC`;

  if (limit != null) {
    params.push(limit);
    sql += ` LIMIT $${params.length}`;
  }
  if (offset != null) {
    params.push(offset);
    sql += ` OFFSET $${params.length}`;
  }

  const [{ rows }, countResult] = await Promise.all([
    query(sql, params),
    query(`SELECT COUNT(*) AS total FROM app.api_network_explorer_mv WHERE ssid ILIKE $1`, [
      searchPattern,
    ]),
  ]);

  // If called with pagination args return paginated shape, otherwise plain array (legacy)
  if (limit != null || offset != null) {
    return { rows, total: parseInt(countResult.rows[0]?.total || '0', 10) };
  }
  return rows;
};

const getManufacturerByBSSID = async (prefix: string): Promise<any | null> => {
  const { rows } = await query(
    `SELECT oui_prefix_24bit as prefix, organization_name as manufacturer, organization_address as address
     FROM app.radio_manufacturers WHERE oui_prefix_24bit = $1 LIMIT 1`,
    [prefix]
  );
  return rows.length > 0 ? rows[0] : null;
};

export {
  explainQuery,
  getManufacturerByBSSID,
  getNetworkCount,
  listNetworks,
  searchNetworksBySSID,
};
