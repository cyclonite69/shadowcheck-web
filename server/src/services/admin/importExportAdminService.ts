/**
 * Import/Export Admin Service
 * Administrative operations for data import/export
 */

const { adminQuery } = require('../adminDbService');
const { query } = require('../../config/database');

export async function getBackupData(): Promise<{
  networks: any[];
  observations: any[];
  tags: any[];
}> {
  const networks = await query('SELECT * FROM app.network_entries ORDER BY bssid');
  const observations = await query('SELECT * FROM app.observations ORDER BY time DESC LIMIT 10000');
  const tags = await query('SELECT * FROM app.network_tags ORDER BY bssid');

  return {
    networks: networks.rows,
    observations: observations.rows,
    tags: tags.rows,
  };
}

export async function exportMLTrainingData(): Promise<any[]> {
  const { rows } = await query(
    `SELECT
      ne.bssid,
      ne.ssid,
      ne.observations AS observation_count,
      ne.unique_days,
      ne.unique_locations,
      ne.signal AS max_signal,
      ne.max_distance_meters,
      CASE WHEN nt.threat_tag IN ('THREAT', 'INVESTIGATE') THEN 1 ELSE 0 END AS is_threat,
      nt.threat_tag,
      nt.is_ignored
    FROM app.network_entries ne
    LEFT JOIN app.network_tags nt ON ne.bssid = nt.bssid
    WHERE nt.threat_tag IS NOT NULL
    ORDER BY ne.bssid`
  );
  return rows;
}

export async function getImportCounts(): Promise<{ observations: number; networks: number }> {
  const obsResult = await query('SELECT COUNT(*) as count FROM app.observations');
  const netResult = await query('SELECT COUNT(*) as count FROM app.network_entries');
  return {
    observations: parseInt(obsResult.rows[0].count, 10),
    networks: parseInt(netResult.rows[0].count, 10),
  };
}

export async function truncateAllData(): Promise<void> {
  await adminQuery('TRUNCATE TABLE app.observations CASCADE');
  await adminQuery('TRUNCATE TABLE app.network_entries CASCADE');
  await adminQuery('TRUNCATE TABLE app.network_tags CASCADE');
}

module.exports = {
  getBackupData,
  exportMLTrainingData,
  getImportCounts,
  truncateAllData,
};
