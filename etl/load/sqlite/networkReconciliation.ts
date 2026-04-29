import { Pool } from 'pg';
import sqlite3 from 'sqlite3';
import type { SqliteNetworkRow } from './types';

const cleanString = (s: string | null | undefined): string | null => {
  if (!s) return null;
  const cleaned = s.replace(/\x00/g, '').trim();
  return cleaned || null;
};

export async function upsertNetworks(
  pool: Pool,
  sqliteFile: string,
  latestTimeMs: number,
  networkCache: Map<string, SqliteNetworkRow>,
  debug: boolean
): Promise<void> {
  console.log('\n📡 Upserting networks...');

  const bssids = await new Promise<string[]>((resolve, reject) => {
    const db = new (sqlite3.verbose().Database)(sqliteFile, sqlite3.OPEN_READONLY);
    db.all(
      `SELECT DISTINCT UPPER(bssid) as bssid FROM location WHERE time > ?`,
      [latestTimeMs],
      (err: Error | null, rows: { bssid: string }[]) => {
        db.close();
        if (err) reject(err);
        else resolve(rows.map((r) => r.bssid));
      }
    );
  });

  console.log(`   Found ${bssids.length.toLocaleString()} unique BSSIDs to upsert`);

  let upserted = 0;
  let placeholders = 0;

  for (const bssid of bssids) {
    const network = networkCache.get(bssid);
    try {
      await pool.query(
        `
        INSERT INTO app.networks (
          bssid, ssid, type, frequency, capabilities, service, rcois, mfgrid,
          lasttime_ms, lastlat, lastlon, bestlevel, bestlat, bestlon
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT (bssid) DO UPDATE SET
          ssid = COALESCE(NULLIF(EXCLUDED.ssid, ''), app.networks.ssid),
          frequency = COALESCE(NULLIF(EXCLUDED.frequency, 0), app.networks.frequency),
          bestlevel = GREATEST(EXCLUDED.bestlevel, app.networks.bestlevel),
          lasttime_ms = GREATEST(EXCLUDED.lasttime_ms, app.networks.lasttime_ms),
          lastlat = CASE WHEN EXCLUDED.lasttime_ms > app.networks.lasttime_ms THEN EXCLUDED.lastlat ELSE app.networks.lastlat END,
          lastlon = CASE WHEN EXCLUDED.lasttime_ms > app.networks.lasttime_ms THEN EXCLUDED.lastlon ELSE app.networks.lastlon END
        `,
        [
          bssid,
          cleanString(network?.ssid) || '',
          network?.type || 'W',
          network?.frequency || 0,
          cleanString(network?.capabilities) || '',
          cleanString(network?.service) || '',
          cleanString(network?.rcois) || '',
          network?.mfgrid || 0,
          network?.lasttime || 0,
          network?.lastlat || 0,
          network?.lastlon || 0,
          network?.bestlevel || 0,
          network?.bestlat || 0,
          network?.bestlon || 0,
        ]
      );
      upserted++;
      if (!network) placeholders++;
    } catch (error) {
      if (debug) {
        const e = error as Error;
        console.error(`   Network upsert failed for ${bssid}: ${e.message}`);
      }
    }
  }

  console.log(
    `   Upserted ${upserted.toLocaleString()} networks (${placeholders.toLocaleString()} placeholder parent rows)`
  );
}

export async function backfillMissingNetworksFromObservations(
  pool: Pool,
  sourceTag: string,
  latestTimeMs: number
): Promise<void> {
  console.log('\n🩹 Backfilling missing networks from imported observations...');

  const result = await pool.query(
    `
    WITH new_obs AS (
      SELECT *
      FROM app.observations
      WHERE source_tag = $1
        AND time_ms > $2
    ),
    latest AS (
      SELECT DISTINCT ON (UPPER(bssid))
        UPPER(bssid) AS bssid,
        COALESCE(ssid, '') AS ssid,
        COALESCE(radio_type, 'W') AS type,
        COALESCE(radio_frequency, 0) AS frequency,
        COALESCE(radio_capabilities, '') AS capabilities,
        COALESCE(radio_service, '') AS service,
        COALESCE(radio_rcois, '') AS rcois,
        COALESCE(mfgrid, 0) AS mfgrid,
        COALESCE(time_ms, observed_at_ms, (EXTRACT(EPOCH FROM time) * 1000)::bigint) AS lasttime_ms,
        COALESCE(lat, 0) AS lastlat,
        COALESCE(lon, 0) AS lastlon
      FROM new_obs
      ORDER BY
        UPPER(bssid),
        COALESCE(time_ms, observed_at_ms, (EXTRACT(EPOCH FROM time) * 1000)::bigint) DESC NULLS LAST
    ),
    best AS (
      SELECT DISTINCT ON (UPPER(bssid))
        UPPER(bssid) AS bssid,
        COALESCE(level, 0) AS bestlevel,
        COALESCE(lat, 0) AS bestlat,
        COALESCE(lon, 0) AS bestlon
      FROM new_obs
      ORDER BY
        UPPER(bssid),
        COALESCE(level, 0) DESC,
        COALESCE(time_ms, observed_at_ms, (EXTRACT(EPOCH FROM time) * 1000)::bigint) DESC NULLS LAST
    )
    INSERT INTO app.networks (
      bssid, ssid, type, frequency, capabilities, service, rcois, mfgrid,
      lasttime_ms, lastlat, lastlon, bestlevel, bestlat, bestlon
    )
    SELECT
      l.bssid,
      l.ssid,
      l.type,
      l.frequency,
      l.capabilities,
      l.service,
      l.rcois,
      l.mfgrid,
      l.lasttime_ms,
      l.lastlat,
      l.lastlon,
      COALESCE(b.bestlevel, 0),
      COALESCE(b.bestlat, l.lastlat),
      COALESCE(b.bestlon, l.lastlon)
    FROM latest l
    LEFT JOIN best b ON b.bssid = l.bssid
    LEFT JOIN app.networks n ON UPPER(n.bssid) = l.bssid
    WHERE n.bssid IS NULL
    ON CONFLICT (bssid) DO NOTHING
    `,
    [sourceTag, latestTimeMs]
  );

  console.log(`   Backfilled ${result.rowCount?.toLocaleString() || 0} missing network(s)`);
}

export async function moveOrphanNetworksToHoldingTable(pool: Pool): Promise<void> {
  console.log('\n📦 Moving orphan networks into holding table...');

  const insertResult = await pool.query(`
    INSERT INTO app.networks_orphans
    SELECT n.*, NOW() AS moved_at, 'no_observations_after_import' AS move_reason
    FROM app.networks n
    WHERE NOT EXISTS (
      SELECT 1 FROM app.observations o WHERE o.bssid = n.bssid
    )
    ON CONFLICT (bssid) DO UPDATE
    SET
      ssid = EXCLUDED.ssid,
      type = EXCLUDED.type,
      frequency = EXCLUDED.frequency,
      capabilities = EXCLUDED.capabilities,
      service = EXCLUDED.service,
      rcois = EXCLUDED.rcois,
      mfgrid = EXCLUDED.mfgrid,
      lasttime_ms = EXCLUDED.lasttime_ms,
      lastlat = EXCLUDED.lastlat,
      lastlon = EXCLUDED.lastlon,
      bestlevel = EXCLUDED.bestlevel,
      bestlat = EXCLUDED.bestlat,
      bestlon = EXCLUDED.bestlon,
      source_device = EXCLUDED.source_device,
      threat_score_v2 = EXCLUDED.threat_score_v2,
      threat_factors = EXCLUDED.threat_factors,
      threat_level = EXCLUDED.threat_level,
      threat_updated_at = EXCLUDED.threat_updated_at,
      ml_threat_score = EXCLUDED.ml_threat_score,
      wigle_v3_observation_count = EXCLUDED.wigle_v3_observation_count,
      wigle_v3_last_import_at = EXCLUDED.wigle_v3_last_import_at,
      min_altitude_m = EXCLUDED.min_altitude_m,
      max_altitude_m = EXCLUDED.max_altitude_m,
      altitude_span_m = EXCLUDED.altitude_span_m,
      last_altitude_m = EXCLUDED.last_altitude_m,
      altitude_m = EXCLUDED.altitude_m,
      altitude_accuracy_m = EXCLUDED.altitude_accuracy_m,
      unique_days = EXCLUDED.unique_days,
      unique_locations = EXCLUDED.unique_locations,
      is_sentinel = EXCLUDED.is_sentinel,
      accuracy_meters = EXCLUDED.accuracy_meters,
      moved_at = NOW(),
      move_reason = EXCLUDED.move_reason
  `);

  const deleteResult = await pool.query(`
    DELETE FROM app.networks n
    WHERE NOT EXISTS (
      SELECT 1 FROM app.observations o WHERE o.bssid = n.bssid
    )
  `);

  console.log(
    `   Preserved ${insertResult.rowCount?.toLocaleString() || 0} orphan network(s) in app.networks_orphans`
  );
  console.log(
    `   Removed ${deleteResult.rowCount?.toLocaleString() || 0} orphan network(s) from canonical app.networks`
  );
}
