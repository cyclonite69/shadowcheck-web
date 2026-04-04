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
      throw new Error('Home location markers table is missing (app.location_markers).');
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

module.exports = {
  checkHomeLocationForFilters,
  executeExplorerQuery,
  listNetworks,
  listNetworksV2,
};
