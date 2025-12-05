#!/usr/bin/env node
/**
 * Test WiGLE SQLite Import - Small batch for testing
 * Maps to actual shadowcheck_db schema
 */

const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
const path = require('path');
const { execSync } = require('child_process');

// Get password from keyring
function getKeyringPassword(service, username) {
  const script = `
import dbus
from dbus.mainloop.glib import DBusGMainLoop
DBusGMainLoop(set_as_default=True)
bus = dbus.SessionBus()
secret_service = bus.get_object('org.freedesktop.secrets', '/org/freedesktop/secrets')
service_iface = dbus.Interface(secret_service, 'org.freedesktop.Secret.Service')
attributes = {'service': '${service}', 'username': '${username}'}
items = service_iface.SearchItems(attributes)
if items and items[0]:
    item_path = items[0][0]
    item = bus.get_object('org.freedesktop.secrets', item_path)
    item_iface = dbus.Interface(item, 'org.freedesktop.Secret.Item')
    session_path = service_iface.OpenSession('plain', '')[1]
    secret = item_iface.GetSecret(session_path)
    password = ''.join(chr(b) for b in secret[2])
    print(password)
`;
  return execSync(`python3 -c "${script}"`, { encoding: 'utf-8' }).trim();
}

const dbPassword = getKeyringPassword('shadowcheck', 'postgres_password');

const pgPool = new Pool({
  user: 'shadowcheck_user',
  host: 'localhost',
  database: 'shadowcheck_db',
  password: dbPassword,
  port: 5432,
});

const sqliteFile = path.join(__dirname, '../../backup-1764309125210.sqlite');
const LIMIT = process.argv[2] || 100;

async function testImport() {
  console.log('🧪 TEST Import - WiGLE SQLite to PostgreSQL');
  console.log(`📁 Source: ${sqliteFile}`);
  console.log(`📊 Limit: ${LIMIT} networks\n`);

  const sqliteDb = new sqlite3.Database(sqliteFile, sqlite3.OPEN_READONLY);

  try {
    // Create import record
    const importResult = await pgPool.query(`
            INSERT INTO app.imports (
                source_type, source_file, status, started_at
            ) VALUES (
                'wigle_app', $1, 'processing', NOW()
            ) RETURNING id
        `, [sqliteFile]);

    const importId = importResult.rows[0].id;
    console.log(`📝 Import ID: ${importId}\n`);

    const stats = {
      networks: 0,
      observations: 0,
      errors: [],
    };

    // Test networks import
    console.log('📡 Testing networks import...');
    await importNetworks(sqliteDb, importId, stats);

    // Test observations import
    console.log('\n📍 Testing observations import...');
    await importObservations(sqliteDb, importId, stats);

    // Update import record
    await pgPool.query(`
            UPDATE app.imports SET
                status = 'completed',
                completed_at = NOW(),
                duration_seconds = EXTRACT(EPOCH FROM (NOW() - started_at)),
                records_imported = $1,
                errors = $2
            WHERE id = $3
        `, [
      stats.networks + stats.observations,
      JSON.stringify(stats.errors.slice(0, 10)),
      importId,
    ]);

    console.log('\n✅ Test completed!');
    console.log(`   Networks: ${stats.networks}`);
    console.log(`   Observations: ${stats.observations}`);
    console.log(`   Errors: ${stats.errors.length}`);

    if (stats.errors.length > 0) {
      console.log('\n❌ Sample errors:');
      stats.errors.slice(0, 3).forEach(e => {
        console.log(`   ${e.type}: ${e.error} (${e.id})`);
      });
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  } finally {
    sqliteDb.close();
    await pgPool.end();
  }
}

async function importNetworks(sqliteDb, importId, stats) {
  return new Promise((resolve, reject) => {
    const networks = [];

    sqliteDb.each(
      `SELECT * FROM network LIMIT ${LIMIT}`,
      (err, row) => {
        if (err) {
          stats.errors.push({ type: 'network_read', error: err.message, id: row?.bssid });
          return;
        }
        networks.push(row);
      },
      async (err) => {
        if (err) {
          reject(err);
          return;
        }

        console.log(`   Found ${networks.length} networks in SQLite`);

        for (const row of networks) {
          try {
            // Convert WiGLE timestamp (milliseconds) to PostgreSQL timestamp
            const lastSeenDate = new Date(row.lasttime);

            // Get coordinates with fallback
            const lat = row.bestlat || row.lastlat || null;
            const lon = row.bestlon || row.lastlon || null;

            // Only insert if we have valid coordinates
            if (lat === null || lon === null || lat === 0 || lon === 0) {
              stats.errors.push({ type: 'network_skip', error: 'Missing coordinates', id: row.bssid });
              continue;
            }

            await pgPool.query(`
                            INSERT INTO app.networks (
                                bssid, ssid,
                                first_seen, last_seen,
                                frequency, encryption, max_signal,
                                latitude, longitude, location
                            ) VALUES (
                                $1, $2,
                                $3, $4,
                                $5::numeric, $6, $7,
                                $8::numeric, $9::numeric, ST_SetSRID(ST_MakePoint($9::numeric, $8::numeric), 4326)::geography
                            )
                            ON CONFLICT (bssid) DO UPDATE SET
                                ssid = EXCLUDED.ssid,
                                last_seen = GREATEST(networks.last_seen, EXCLUDED.last_seen),
                                frequency = EXCLUDED.frequency,
                                encryption = EXCLUDED.encryption,
                                max_signal = GREATEST(networks.max_signal, EXCLUDED.max_signal),
                                latitude = EXCLUDED.latitude,
                                longitude = EXCLUDED.longitude,
                                location = EXCLUDED.location
                        `, [
              row.bssid, // $1
              row.ssid || '<Hidden>', // $2
              lastSeenDate, // $3 first_seen
              lastSeenDate, // $4 last_seen
              row.frequency, // $5
              row.capabilities || 'OPEN', // $6
              row.bestlevel || null, // $7
              lat, // $8 latitude
              lon, // $9 longitude
            ]);

            stats.networks++;
            if (stats.networks % 25 === 0) {
              process.stdout.write(`\r   Imported ${stats.networks}...`);
            }
          } catch (error) {
            stats.errors.push({ type: 'network_insert', error: error.message, id: row.bssid });
          }
        }

        console.log(`\r   ✓ Imported ${stats.networks} networks`);
        resolve();
      }
    );
  });
}

async function importObservations(sqliteDb, importId, stats) {
  return new Promise((resolve, reject) => {
    const observations = [];

    sqliteDb.each(
      `SELECT * FROM location WHERE bssid IN (SELECT bssid FROM network LIMIT ${LIMIT}) LIMIT ${LIMIT * 5}`,
      (err, row) => {
        if (err) {
          stats.errors.push({ type: 'observation_read', error: err.message, id: row?._id });
          return;
        }
        observations.push(row);
      },
      async (err) => {
        if (err) {
          reject(err);
          return;
        }

        console.log(`   Found ${observations.length} observations in SQLite`);

        for (const row of observations) {
          try {
            const observedAt = new Date(row.time);
            const epochMs = row.time;

            await pgPool.query(`
                            INSERT INTO app.observations (
                                radio_type, identifier,
                                latitude, longitude, location,
                                altitude_meters, accuracy_meters, signal_dbm,
                                observed_at, observed_at_epoch,
                                source_type, import_id,
                                radio_metadata, metadata
                            ) VALUES (
                                'wifi'::radio_type, $1,
                                $2, $3, ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography,
                                $4, $5, $6,
                                $7, $8,
                                'wigle_app'::source_type, $9,
                                '{}'::jsonb, $10::jsonb
                            )
                        `, [
              row.bssid,
              row.lat,
              row.lon,
              row.altitude,
              row.accuracy,
              row.level,
              observedAt,
              epochMs,
              importId,
              JSON.stringify({
                external: row.external,
                mfgrid: row.mfgrid,
              }),
            ]);

            stats.observations++;
            if (stats.observations % 100 === 0) {
              process.stdout.write(`\r   Imported ${stats.observations}...`);
            }
          } catch (error) {
            stats.errors.push({ type: 'observation_insert', error: error.message, id: row._id });
          }
        }

        console.log(`\r   ✓ Imported ${stats.observations} observations`);
        resolve();
      }
    );
  });
}

// Run test
if (require.main === module) {
  testImport().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
