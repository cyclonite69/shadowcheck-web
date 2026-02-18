/**
 * Miscellaneous Service Layer
 * Encapsulates database queries for utility operations
 */

const { pool } = require('../config/database');

export async function getDataQualityMetrics(whereClause: string): Promise<any> {
  const qualityQuery = `
    SELECT COUNT(*) as total_observations,
           COUNT(DISTINCT bssid) as unique_networks,
           MIN(time) as earliest_time,
           MAX(time) as latest_time
    FROM observations 
    WHERE 1=1 ${whereClause}
  `;

  const result = await pool.query(qualityQuery);
  return result.rows[0];
}

module.exports = {
  getDataQualityMetrics,
};
