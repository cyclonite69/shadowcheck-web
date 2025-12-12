#!/usr/bin/env node
/**
 * Multi-threaded WiGLE Import - Full Precision, Full Database
 *
 * Features:
 * - Multi-threaded parallel processing
 * - Full precision (DOUBLE PRECISION, no rounding)
 * - Unix epoch milliseconds storage
 * - Observations as source of truth (triggers auto-populate networks)
 * - BSSID uppercase normalization
 * - Coordinate and timestamp validation
 * - Batch processing for performance
 */

const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

// Configuration
const BATCH_SIZE = 500;
const THREAD_COUNT = os.cpus().length; // Use all CPU cores
const PROGRESS_INTERVAL = 1000;

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
  max: THREAD_COUNT * 2, // Extra connections for parallel processing
});

const sqliteFile = path.join(__dirname, '../../backup-1764309125210.sqlite');

// Validation functions
function validateCoordinates(lat, lon) {
  if (lat === null || lon === null || lat === undefined || lon === undefined) {
    return { valid: false, error: 'Missing coordinates' };
  }
  if (lat < -90 || lat > 90) {
    return { valid: false, error: `Invalid latitude: ${lat}` };
  }
  if (lon < -180 || lon > 180) {
    return { valid: false, error: `Invalid longitude: ${lon}` };
  }
  if (lat === 0 && lon === 0) {
    return { valid: false, error: 'Null island coordinates' };
  }
  return { valid: true };
}

function validateTimestamp(timestampMs) {
  const MIN_TIMESTAMP = 946684800000; // 2000-01-01
  const MAX_TIMESTAMP = Date.now() + 86400000; // Now + 1 day

  if (!timestampMs || timestampMs < MIN_TIMESTAMP || timestampMs > MAX_TIMESTAMP) {
    return { valid: false, error: `Invalid timestamp: ${timestampMs}` };
  }
  return { valid: true };
}

async function fullImport() {
  console.log('🚀 FULL DATABASE IMPORT - Multi-threaded');
  console.log(`📁 Source: ${sqliteFile}`);
  console.log(`🧵 Threads: ${THREAD_COUNT} cores`);
  console.log(`📦 Batch size: ${BATCH_SIZE}`);
  console.log('🔒 Password: From keyring\n');

  const startTime = Date.now();

  try {
    // Create import record
    const importResult = await pgPool.query(
      `
            INSERT INTO app.imports (
                source_type, source_file, status, started_at
            ) VALUES (
                'wigle_app', $1, 'processing', NOW()
            ) RETURNING id
        `,
      [sqliteFile]
    );

    const importId = importResult.rows[0].id;
    console.log(`📝 Import ID: ${importId}\n`);

    const stats = {
      observations: 0,
      networks: 0,
      skipped: 0,
      errors: [],
    };

    // PHASE 1: Import observations (source of truth)
    console.log('📍 Phase 1: Importing OBSERVATIONS (source of truth)');
    console.log('   Triggers will auto-populate networks table\n');
    await importObservations(importId, stats);

    // PHASE 2: Update networks with SSID info
    console.log('\n📡 Phase 2: Enriching NETWORKS with SSID data');
    await enrichNetworks(importId, stats);

    // Update import record
    const duration = Math.floor((Date.now() - startTime) / 1000);
    await pgPool.query(
      `
            UPDATE app.imports SET
                status = 'completed',
                completed_at = NOW(),
                duration_seconds = $1,
                records_total = $2,
                records_imported = $3,
                records_failed = $4,
                errors = $5::jsonb
            WHERE id = $6
        `,
      [
        duration,
        stats.observations + stats.networks,
        stats.observations,
        stats.errors.length,
        JSON.stringify(stats.errors.slice(0, 100)),
        importId,
      ]
    );

    console.log('\n✅ IMPORT COMPLETED!');
    console.log(`   Duration: ${duration}s (${Math.floor(duration / 60)}m ${duration % 60}s)`);
    console.log(`   Observations: ${stats.observations.toLocaleString()}`);
    console.log(`   Networks: ${stats.networks.toLocaleString()} (auto-populated via triggers)`);
    console.log(`   Skipped: ${stats.skipped.toLocaleString()}`);
    console.log(`   Errors: ${stats.errors.length}`);
    console.log(`   Rate: ${Math.floor(stats.observations / duration).toLocaleString()} obs/sec`);
  } catch (error) {
    console.error('❌ Import failed:', error);
    throw error;
  } finally {
    await pgPool.end();
  }
}

async function importObservations(importId, stats) {
  const sqliteDb = new sqlite3.Database(sqliteFile, sqlite3.OPEN_READONLY);

  return new Promise((resolve, reject) => {
    // First, count total
    sqliteDb.get('SELECT COUNT(*) as count FROM location', async (err, countRow) => {
      if (err) {
        reject(err);
        return;
      }

      const totalObservations = countRow.count;
      console.log(`   Total observations in SQLite: ${totalObservations.toLocaleString()}\n`);

      const observations = [];
      let processed = 0;
      let lastProgress = Date.now();

      sqliteDb.each(
        'SELECT * FROM location',
        (err, row) => {
          if (err) {
            stats.errors.push({ type: 'sqlite_read', error: err.message });
            return;
          }
          observations.push(row);

          // Process in batches
          if (observations.length >= BATCH_SIZE) {
            const batch = [...observations];
            observations.length = 0;

            processObservationBatch(batch, importId, stats).then(() => {
              processed += batch.length;

              // Progress update
              const now = Date.now();
              if (now - lastProgress >= PROGRESS_INTERVAL) {
                const pct = ((processed / totalObservations) * 100).toFixed(1);
                const rate = Math.floor(processed / ((now - lastProgress) / 1000));
                process.stdout.write(
                  `\r   Progress: ${processed.toLocaleString()}/${totalObservations.toLocaleString()} (${pct}%) - ${rate}/sec   `
                );
                lastProgress = now;
              }
            });
          }
        },
        async (err) => {
          if (err) {
            reject(err);
            return;
          }

          // Process remaining batch
          if (observations.length > 0) {
            await processObservationBatch(observations, importId, stats);
            processed += observations.length;
          }

          console.log(
            `\r   ✓ Imported ${stats.observations.toLocaleString()} observations              `
          );
          sqliteDb.close();
          resolve();
        }
      );
    });
  });
}

async function processObservationBatch(rows, importId, stats) {
  const client = await pgPool.connect();

  try {
    await client.query('BEGIN');

    for (const row of rows) {
      // Validate coordinates
      const coordCheck = validateCoordinates(row.lat, row.lon);
      if (!coordCheck.valid) {
        stats.skipped++;
        stats.errors.push({ type: 'invalid_coords', error: coordCheck.error, id: row._id });
        continue;
      }

      // Validate timestamp
      const tsCheck = validateTimestamp(row.time);
      if (!tsCheck.valid) {
        stats.skipped++;
        stats.errors.push({ type: 'invalid_timestamp', error: tsCheck.error, id: row._id });
        continue;
      }

      try {
        // Convert epoch ms to timestamptz
        const observedAt = new Date(row.time);

        // Insert observation - triggers will handle network upsert
        await client.query(
          `
                    INSERT INTO app.observations (
                        radio_type, identifier,
                        latitude, longitude, location,
                        altitude_meters, accuracy_meters, signal_dbm,
                        observed_at, observed_at_epoch,
                        source_type, import_id,
                        radio_metadata, metadata
                    ) VALUES (
                        'wifi'::radio_type, UPPER($1),
                        $2::double precision, $3::double precision,
                        ST_SetSRID(ST_MakePoint($3::double precision, $2::double precision), 4326)::geography,
                        $4::double precision, $5::double precision, $6::double precision,
                        $7::timestamptz, $8::bigint,
                        'wigle_app'::source_type, $9,
                        '{}'::jsonb, $10::jsonb
                    )
                `,
          [
            row.bssid, // Will be uppercased by trigger
            row.lat, // Full precision
            row.lon, // Full precision
            row.altitude, // Full precision
            row.accuracy, // Full precision
            row.level, // Full precision (signal)
            observedAt, // Proper timestamptz
            row.time, // Unix epoch milliseconds
            importId,
            JSON.stringify({
              external: row.external,
              mfgrid: row.mfgrid,
            }),
          ]
        );

        stats.observations++;
      } catch (error) {
        stats.errors.push({
          type: 'observation_insert',
          error: error.message,
          id: row._id,
          bssid: row.bssid,
        });
      }
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function enrichNetworks(importId, stats) {
  const sqliteDb = new sqlite3.Database(sqliteFile, sqlite3.OPEN_READONLY);

  return new Promise((resolve, reject) => {
    const updates = [];

    sqliteDb.each(
      'SELECT bssid, ssid, frequency, capabilities FROM network',
      (err, row) => {
        if (err) {
          stats.errors.push({ type: 'network_read', error: err.message });
          return;
        }
        updates.push(row);

        if (updates.length >= BATCH_SIZE) {
          const batch = [...updates];
          updates.length = 0;
          processNetworkBatch(batch, stats);
        }
      },
      async (err) => {
        if (err) {
          reject(err);
          return;
        }

        // Process remaining
        if (updates.length > 0) {
          await processNetworkBatch(updates, stats);
        }

        console.log(`   ✓ Enriched ${stats.networks.toLocaleString()} networks with SSID data`);
        sqliteDb.close();
        resolve();
      }
    );
  });
}

async function processNetworkBatch(rows, stats) {
  const client = await pgPool.connect();

  try {
    await client.query('BEGIN');

    for (const row of rows) {
      try {
        const bssid = row.bssid.toUpperCase();

        await client.query(
          `
                    UPDATE app.networks SET
                        ssid = $2,
                        frequency = $3::numeric,
                        encryption = $4
                    WHERE bssid = $1
                `,
          [bssid, row.ssid || '<Hidden>', row.frequency, row.capabilities || 'OPEN']
        );

        stats.networks++;

        if (stats.networks % 1000 === 0) {
          process.stdout.write(`\r   Enriched ${stats.networks.toLocaleString()} networks...`);
        }
      } catch (error) {
        stats.errors.push({
          type: 'network_update',
          error: error.message,
          bssid: row.bssid,
        });
      }
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Run import
if (require.main === module) {
  fullImport().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

module.exports = { fullImport };
