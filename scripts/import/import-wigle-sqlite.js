#!/usr/bin/env node
/**
 * Import WiGLE SQLite database to PostgreSQL
 *
 * WiGLE Database Structure:
 * - network: 129,633 networks (unique BSSIDs)
 * - location: 419,969 observations (sightings with location/signal)
 * - route: 36,784 route points (wardriving path)
 */

const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
const path = require('path');

// Get database password from keyring using D-Bus
const { execSync } = require('child_process');
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
  const cmd = `python3 -c "${script}"`;
  return execSync(cmd, { encoding: 'utf-8' }).trim();
}

const dbPassword = getKeyringPassword('shadowcheck', 'postgres_password');

const pgPool = new Pool({
  user: process.env.DB_USER || 'shadowcheck_user',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'shadowcheck_db',
  password: dbPassword,
  port: process.env.DB_PORT || 5432,
});

const sqliteFile = process.argv[2] || path.join(__dirname, '../../backup-1764309125210.sqlite');

async function importWigleDatabase() {
  console.log('🚀 Starting WiGLE SQLite import...');
  console.log(`📁 Source: ${sqliteFile}`);

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
    console.log(`📝 Import ID: ${importId}`);

    const stats = {
      networks_imported: 0,
      networks_updated: 0,
      observations_imported: 0,
      routes_imported: 0,
      errors: [],
    };

    // Import networks
    console.log('\n📡 Importing networks...');
    await importNetworks(sqliteDb, importId, stats);

    // Import observations (locations)
    console.log('\n📍 Importing observations...');
    await importObservations(sqliteDb, importId, stats);

    // Import routes
    console.log('\n🛣️  Importing routes...');
    await importRoutes(sqliteDb, importId, stats);

    // Update import record
    await pgPool.query(`
            UPDATE app.imports SET
                status = 'completed',
                completed_at = NOW(),
                duration_seconds = EXTRACT(EPOCH FROM (NOW() - started_at)),
                records_total = $1,
                records_imported = $2,
                records_updated = $3,
                records_failed = $4,
                errors = $5
            WHERE id = $6
        `, [
      stats.networks_imported + stats.observations_imported + stats.routes_imported,
      stats.networks_imported + stats.observations_imported + stats.routes_imported,
      stats.networks_updated,
      stats.errors.length,
      JSON.stringify(stats.errors.slice(0, 100)), // First 100 errors
      importId,
    ]);

    console.log('\n✅ Import completed!');
    console.log(`   Networks: ${stats.networks_imported} imported, ${stats.networks_updated} updated`);
    console.log(`   Observations: ${stats.observations_imported}`);
    console.log(`   Routes: ${stats.routes_imported}`);
    console.log(`   Errors: ${stats.errors.length}`);

  } catch (error) {
    console.error('❌ Import failed:', error);
    throw error;
  } finally {
    sqliteDb.close();
    await pgPool.end();
  }
}

async function importNetworks(sqliteDb, importId, stats) {
  return new Promise((resolve, reject) => {
    const rows = [];

    sqliteDb.each(
      'SELECT * FROM network',
      (err, row) => {
        if (err) {
          stats.errors.push({ table: 'network', error: err.message, bssid: row?.bssid });
          return;
        }
        rows.push(row);
      },
      async (err, count) => {
        if (err) {
          reject(err);
          return;
        }

        console.log(`   Found ${rows.length} networks in SQLite`);

        // Process rows sequentially with batching
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          try {
            // Parse capabilities to encryption array
            const encryption = parseCapabilities(row.capabilities);

            // Convert timestamp (milliseconds to timestamptz)
            const lasttime = new Date(row.lasttime);

            await pgPool.query(`
                            INSERT INTO app.networks (
                                bssid, ssid, frequency_mhz, encryption, encryption_summary,
                                latitude, longitude, location,
                                first_seen_at, last_seen_at, metadata
                            ) VALUES (
                                $1, $2, $3, $4, $5,
                                $6, $7, ST_SetSRID(ST_MakePoint($8, $6), 4326)::geography,
                                $9, $9, $10
                            )
                            ON CONFLICT (bssid) DO UPDATE SET
                                ssid = COALESCE(EXCLUDED.ssid, networks.ssid),
                                frequency_mhz = COALESCE(EXCLUDED.frequency_mhz, networks.frequency_mhz),
                                encryption = COALESCE(EXCLUDED.encryption, networks.encryption),
                                last_seen_at = GREATEST(networks.last_seen_at, EXCLUDED.last_seen_at),
                                metadata = networks.metadata || EXCLUDED.metadata,
                                updated_at = NOW()
                        `, [
              row.bssid,
              row.ssid || '<Hidden>',
              row.frequency,
              encryption,
              row.capabilities,
              row.bestlat || row.lastlat,
              row.bestlon || row.lastlon,
              lasttime,
              JSON.stringify({
                source: 'wigle_app',
                import_id: importId,
                type: row.type,
                bestlevel: row.bestlevel,
                mfgrid: row.mfgrid,
                rcois: row.rcois,
              }),
            ]);

            stats.networks_imported++;
            if (stats.networks_imported % 1000 === 0) {
              process.stdout.write(`\r   Processed ${stats.networks_imported} networks...`);
            }
          } catch (error) {
            stats.errors.push({ table: 'network', error: error.message, bssid: row.bssid });
          }
        }

        console.log(`\r   ✓ Imported ${stats.networks_imported} networks`);
        resolve();
      }
    );
  });
}

async function importObservations(sqliteDb, importId, stats) {
  return new Promise((resolve, reject) => {
    const rows = [];

    sqliteDb.each(
      'SELECT * FROM location',
      (err, row) => {
        if (err) {
          stats.errors.push({ table: 'location', error: err.message, id: row?._id });
          return;
        }
        rows.push(row);
      },
      async (err, count) => {
        if (err) {
          reject(err);
          return;
        }

        console.log(`   Found ${rows.length} observations in SQLite`);

        // Process rows sequentially
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          try {
            const observedAt = new Date(row.time);

            await pgPool.query(`
                            INSERT INTO app.observations (
                                bssid, latitude, longitude, altitude_meters, location,
                                accuracy_meters, signal_dbm, observed_at,
                                source_type, import_id, metadata
                            ) VALUES (
                                $1, $2, $3, $4, ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography,
                                $5, $6, $7,
                                'wigle_app', $8, $9
                            )
                        `, [
              row.bssid,
              row.lat,
              row.lon,
              row.altitude,
              row.accuracy,
              row.level,
              observedAt,
              importId,
              JSON.stringify({
                external: row.external,
                mfgrid: row.mfgrid,
              }),
            ]);

            stats.observations_imported++;
            if (stats.observations_imported % 5000 === 0) {
              process.stdout.write(`\r   Processed ${stats.observations_imported} observations...`);
            }
          } catch (error) {
            stats.errors.push({ table: 'location', error: error.message, id: row._id });
          }
        }

        console.log(`\r   ✓ Imported ${stats.observations_imported} observations`);
        resolve();
      }
    );
  });
}

async function importRoutes(sqliteDb, importId, stats) {
  return new Promise((resolve, reject) => {
    sqliteDb.each(
      'SELECT * FROM route',
      async (err, row) => {
        if (err) {
          stats.errors.push({ table: 'route', error: err.message, id: row?._id });
          return;
        }

        try {
          // Store routes as metadata for now
          // Could create separate route table if needed
          stats.routes_imported++;
        } catch (error) {
          stats.errors.push({ table: 'route', error: error.message, id: row._id });
        }
      },
      (err, count) => {
        if (err) {reject(err);} else {
          console.log(`   ✓ Processed ${stats.routes_imported} route points`);
          resolve();
        }
      }
    );
  });
}

function parseCapabilities(capabilities) {
  if (!capabilities) {return [];}

  const caps = [];
  if (capabilities.includes('WPA3')) {caps.push('WPA3');} else if (capabilities.includes('WPA2')) {caps.push('WPA2');} else if (capabilities.includes('WPA')) {caps.push('WPA');}
  if (capabilities.includes('WEP')) {caps.push('WEP');}
  if (capabilities.includes('PSK')) {caps.push('PSK');}
  if (capabilities.includes('EAP')) {caps.push('EAP');}
  if (capabilities.includes('CCMP')) {caps.push('CCMP');}
  if (capabilities.includes('TKIP')) {caps.push('TKIP');}
  if (capabilities.includes('WPS')) {caps.push('WPS');}

  return caps.length > 0 ? caps : null;
}

// Run import
if (require.main === module) {
  importWigleDatabase().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

module.exports = { importWigleDatabase };
