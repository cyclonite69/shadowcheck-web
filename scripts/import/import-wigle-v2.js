#!/usr/bin/env node
const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
const { execSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');

const dbPassword = execSync('/home/cyclonite01/ShadowCheckPentest/venv/bin/python3 -c "import keyring; print(keyring.get_password(\'shadowcheck\', \'postgres_password\'))"', { encoding: 'utf-8' }).trim();

const pgPool = new Pool({
  user: 'shadowcheck_user',
  host: 'localhost',
  database: 'shadowcheck_db',
  password: dbPassword,
  port: 5432,
});

const sqliteFile = process.argv[2] || '/home/cyclonite01/ShadowCheckStatic/backup-1764309125210.sqlite';

async function importWigleDatabase() {
  console.log('🚀 Starting WiGLE import...');
  console.log(`📁 Source: ${sqliteFile}`);

  const sqliteDb = new sqlite3.Database(sqliteFile, sqlite3.OPEN_READONLY);
  const fileHash = crypto.createHash('sha256').update(fs.readFileSync(sqliteFile)).digest('hex');

  try {
    const importResult = await pgPool.query(`
            INSERT INTO app.imports (source_type, source_file, status, started_at)
            VALUES ('wigle_app', $1, 'processing', NOW()) RETURNING id
        `, [sqliteFile]);

    const importId = importResult.rows[0].id;
    console.log(`📝 Import ID: ${importId}\n`);

    const stats = { networks: 0, observations: 0, errors: [] };

    // Import network table
    console.log('📦 Backing up network table...');
    const networks = await queryAll(sqliteDb, 'SELECT * FROM network');
    for (const row of networks) {
      try {
        // Validate and normalize
        const bssid = (row.bssid || '').toUpperCase();
        if (!bssid || !/^[0-9A-F]{2}(:[0-9A-F]{2}){5}$/.test(bssid)) {
          stats.errors.push({ table: 'network', bssid: row.bssid, error: 'Invalid BSSID format' });
          continue;
        }

        // Validate coordinates
        const lastLat = parseFloat(row.lastlat);
        const lastLon = parseFloat(row.lastlon);
        const bestLat = parseFloat(row.bestlat);
        const bestLon = parseFloat(row.bestlon);

        if (isNaN(lastLat) || isNaN(lastLon) || lastLat < -90 || lastLat > 90 || lastLon < -180 || lastLon > 180) {
          stats.errors.push({ table: 'network', bssid, error: 'Invalid last coordinates' });
          continue;
        }

        if (isNaN(bestLat) || isNaN(bestLon) || bestLat < -90 || bestLat > 90 || bestLon < -180 || bestLon > 180) {
          stats.errors.push({ table: 'network', bssid, error: 'Invalid best coordinates' });
          continue;
        }

        // Validate timestamp (Unix epoch milliseconds)
        const lastTime = parseInt(row.lasttime);
        if (isNaN(lastTime) || lastTime <= 0 || lastTime > Date.now() + 86400000) {
          stats.errors.push({ table: 'network', bssid, error: 'Invalid timestamp' });
          continue;
        }

        await pgPool.query(`
                    INSERT INTO import.wigle_networks_raw (
                        bssid, ssid, frequency_mhz, capabilities,
                        last_time, last_latitude, last_longitude, last_location,
                        type, best_level, best_latitude, best_longitude, best_location,
                        rcois, mfgrid, service, import_id
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7,
                        ST_SetSRID(ST_MakePoint($7, $6), 4326)::geography,
                        $8, $9, $10, $11, ST_SetSRID(ST_MakePoint($11, $10), 4326)::geography,
                        $12, $13, $14, $15)
                    ON CONFLICT (bssid) DO NOTHING
                `, [bssid, row.ssid, row.frequency, row.capabilities, lastTime,
          lastLat, lastLon, row.type, row.bestlevel, bestLat,
          bestLon, row.rcois, row.mfgrid, row.service, importId]);
        stats.networks++;
        if (stats.networks % 1000 === 0) {process.stdout.write(`\r   ${stats.networks} networks...`);}
      } catch (err) {
        stats.errors.push({ table: 'network', bssid: row.bssid, error: err.message });
      }
    }
    console.log(`\r   ✓ ${stats.networks} networks backed up\n`);

    // Import location table
    console.log('📍 Importing observations...');
    const locations = await queryAll(sqliteDb, 'SELECT * FROM location');
    for (const row of locations) {
      try {
        // Validate and normalize BSSID
        const bssid = (row.bssid || '').toUpperCase();
        if (!bssid || !/^[0-9A-F]{2}(:[0-9A-F]{2}){5}$/.test(bssid)) {
          stats.errors.push({ table: 'location', id: row._id, error: 'Invalid BSSID format' });
          continue;
        }

        // Validate coordinates
        const lat = parseFloat(row.lat);
        const lon = parseFloat(row.lon);
        const altitude = parseFloat(row.altitude) || 0;
        const accuracy = parseFloat(row.accuracy) || 0;

        if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
          stats.errors.push({ table: 'location', id: row._id, bssid, error: 'Invalid coordinates' });
          continue;
        }

        // Validate timestamp (Unix epoch milliseconds)
        const timestamp = parseInt(row.time);
        if (isNaN(timestamp) || timestamp <= 0 || timestamp > Date.now() + 86400000) {
          stats.errors.push({ table: 'location', id: row._id, bssid, error: 'Invalid timestamp' });
          continue;
        }

        const observedAt = new Date(timestamp);
        const fingerprint = crypto.createHash('md5')
          .update(`wifi${bssid}${observedAt.toISOString()}${lat}${lon}`)
          .digest('hex');

        await pgPool.query(`
                    INSERT INTO app.observations (
                        radio_type, identifier, latitude, longitude, altitude_meters, location,
                        accuracy_meters, signal_dbm, observed_at, observed_at_epoch, source_type, import_id,
                        fingerprint, metadata
                    ) VALUES (
                        'wifi', $1, $2, $3, $4, ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography,
                        $5, $6, $7, $8, 'wigle_app', $9, $10, $11
                    ) ON CONFLICT (fingerprint) DO NOTHING
                `, [bssid, lat, lon, altitude, accuracy, row.level,
          observedAt, timestamp, importId, fingerprint,
          JSON.stringify({ wigle: { external: row.external, mfgrid: row.mfgrid } })]);

        stats.observations++;
        if (stats.observations % 5000 === 0) {process.stdout.write(`\r   ${stats.observations} observations...`);}
      } catch (err) {
        if (!err.message.includes('duplicate')) {
          stats.errors.push({ table: 'location', id: row._id, error: err.message });
        }
      }
    }
    console.log(`\r   ✓ ${stats.observations} observations imported\n`);

    // Enrich observations
    console.log('🔧 Enriching observations...');
    await pgPool.query(`
            UPDATE app.observations o SET
                radio_metadata = jsonb_build_object(
                    'ssid', w.ssid,
                    'frequency_mhz', w.frequency_mhz,
                    'capabilities', w.capabilities
                ),
                metadata = metadata || jsonb_build_object(
                    'wigle', jsonb_build_object(
                        'rcois', w.rcois, 'service', w.service,
                        'mfgrid', w.mfgrid, 'type', w.type
                    )
                )
            FROM import.wigle_networks_raw w
            WHERE o.identifier = w.bssid::text AND o.import_id = $1
        `, [importId]);
    console.log('   ✓ Enrichment complete\n');

    // Record import
    await pgPool.query(`
            INSERT INTO app.import_sources (source_repo, source_db_path, source_db_hash,
                import_type, observation_count, imported_by)
            VALUES ('wigle_app', $1, $2, 'full', $3, 'import-wigle-v2.js')
        `, [sqliteFile, fileHash, stats.observations]);

    await pgPool.query(`
            UPDATE app.imports SET status = 'completed', completed_at = NOW(),
                duration_seconds = EXTRACT(EPOCH FROM (NOW() - started_at)),
                records_total = $1, records_imported = $2, records_failed = $3,
                errors = $4
            WHERE id = $5
        `, [stats.observations, stats.observations, stats.errors.length,
      JSON.stringify(stats.errors.slice(0, 100)), importId]);

    console.log('✅ Import completed!');
    console.log(`   Networks: ${stats.networks}`);
    console.log(`   Observations: ${stats.observations}`);
    console.log(`   Errors: ${stats.errors.length}`);

  } catch (error) {
    console.error('❌ Import failed:', error);
    throw error;
  } finally {
    sqliteDb.close();
    await pgPool.end();
  }
}

function queryAll(db, sql) {
  return new Promise((resolve, reject) => {
    db.all(sql, (err, rows) => {
      if (err) {reject(err);} else {resolve(rows);}
    });
  });
}

if (require.main === module) {
  importWigleDatabase().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
