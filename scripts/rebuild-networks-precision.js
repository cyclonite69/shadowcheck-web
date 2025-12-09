#!/usr/bin/env node

const { Pool } = require('pg');
const secretsManager = require('../src/services/secretsManager');

(async () => {
  try {
    console.log('[Rebuild] Loading secrets...');
    await secretsManager.load();

    const pool = new Pool({
      user: 'shadowcheck_user',
      password: secretsManager.getOrThrow('db_password'),
      host: '127.0.0.1',
      port: 5432,
      database: 'shadowcheck_db',
    });

    console.log('[Rebuild] Fetching all networks...');
    const networks = await pool.query('SELECT DISTINCT bssid FROM app.networks');
    const totalNetworks = networks.rows.length;

    console.log(`[Rebuild] Processing ${totalNetworks} networks...`);

    for (let i = 0; i < totalNetworks; i++) {
      const { bssid } = networks.rows[i];

      const obs = await pool.query(
        `SELECT latitude, longitude, altitude_meters, signal_dbm, observed_at
         FROM app.observations WHERE bssid = $1 ORDER BY observed_at ASC`,
        [bssid]
      );

      if (obs.rows.length === 0) continue;

      const observations = obs.rows;
      const avgLat = observations.reduce((sum, o) => sum + o.latitude, 0) / observations.length;
      const avgLon = observations.reduce((sum, o) => sum + o.longitude, 0) / observations.length;

      const bestSignal = observations.reduce((best, o) => 
        (o.signal_dbm > best.signal_dbm) ? o : best
      );
      const bestLat = bestSignal.latitude;
      const bestLon = bestSignal.longitude;

      const totalPower = observations.reduce((sum, o) => sum + Math.pow(10, o.signal_dbm / 10), 0);
      const trilLat = observations.reduce((sum, o) => 
        sum + (o.latitude * Math.pow(10, o.signal_dbm / 10)), 0
      ) / totalPower;
      const trilLon = observations.reduce((sum, o) => 
        sum + (o.longitude * Math.pow(10, o.signal_dbm / 10)), 0
      ) / totalPower;

      const firstSeen = new Date(observations[0].observed_at);
      const lastSeen = new Date(observations[observations.length - 1].observed_at);

      await pool.query(
        `UPDATE app.networks SET 
          latitude = $1,
          longitude = $2,
          bestlat = $3,
          bestlon = $4,
          bestlevel = $5,
          max_signal = $5,
          lastlat = $6,
          lastlon = $7,
          lasttime = $8,
          trilaterated_lat = $9,
          trilaterated_lon = $10,
          first_seen = $11,
          last_seen = $12,
          location = ST_SetSRID(ST_MakePoint($2, $1), 4326)
         WHERE bssid = $13`,
        [avgLat, avgLon, bestLat, bestLon, bestSignal.signal_dbm, 
         observations[observations.length - 1].latitude, 
         observations[observations.length - 1].longitude,
         Math.floor(new Date(observations[observations.length - 1].observed_at).getTime() / 1000),
         trilLat, trilLon, firstSeen, lastSeen, bssid]
      );

      if ((i + 1) % 1000 === 0) {
        console.log(`[Rebuild] Processed ${i + 1}/${totalNetworks}`);
      }
    }

    console.log(`[Rebuild] ✓ All ${totalNetworks} networks rebuilt with full precision`);
    await pool.end();
  } catch (err) {
    console.error('✗ Failed:', err.message);
    process.exit(1);
  }
})();
