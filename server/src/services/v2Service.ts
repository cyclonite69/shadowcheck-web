/**
 * V2 API Service Layer
 * Encapsulates database queries for V2 API operations
 */

const { query } = require('../config/database');

export async function executeV2Query(sql: string, params: any[]): Promise<any> {
  const result = await query(sql, params);
  return result;
}

module.exports = {
  executeV2Query,
};
