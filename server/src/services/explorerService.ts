/**
 * Explorer Service Layer
 * Encapsulates database queries for explorer operations
 */

const { query } = require('../config/database');

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

module.exports = {
  checkHomeLocationForFilters,
  executeExplorerQuery,
};
