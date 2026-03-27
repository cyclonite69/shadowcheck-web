#!/usr/bin/env tsx
/**
 * Process Observations
 *
 * 1. Normalizes raw import data (BSSID uppercase, coordinate validation)
 * 2. Removes duplicates based on (bssid, lat, lon, time)
 */

import { QueryResult } from 'pg';
import '../loadEnv';
import { createPool } from '../utils/db';

interface CountRow {
  count: string;
}

interface RadioTypeRow {
  radio_type: string | null;
  count: string;
}

interface DeduplicationResult {
  before: number;
  after: number;
  removed: number;
}

const pool = createPool();

export async function normalizeObservations(): Promise<void> {
  console.log('🔄 Normalizing observations...\n');
  const startTime = Date.now();

  try {
    console.log('  [1/4] Standardizing BSSID format...');
    const bssidResult: QueryResult = await pool.query(`
      UPDATE app.observations
      SET bssid = UPPER(bssid)
      WHERE bssid != UPPER(bssid)
    `);
    console.log(`        Updated ${bssidResult.rowCount} BSSIDs`);

    console.log('  [2/3] Validating coordinates...');
    const invalidCoords: QueryResult<CountRow> = await pool.query(`
      SELECT COUNT(*) as count FROM app.observations
      WHERE lat IS NULL
         OR lon IS NULL
         OR lat < -90 OR lat > 90
         OR lon < -180 OR lon > 180
    `);
    console.log(`        Found ${invalidCoords.rows[0].count} invalid coordinates`);

    console.log('  [3/3] Validating radio types...');
    const radioTypes: QueryResult<RadioTypeRow> = await pool.query(`
      SELECT radio_type, COUNT(*) as count
      FROM app.observations
      GROUP BY radio_type
      ORDER BY count DESC
    `);
    console.log('        Radio type distribution:');
    radioTypes.rows.forEach((row) => {
      console.log(`          - ${row.radio_type}: ${parseInt(row.count).toLocaleString()}`);
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✅ Normalization complete in ${duration}s`);
  } catch (error) {
    console.error('❌ Normalization failed:', (error as Error).message);
    throw error;
  }
}

export async function deduplicateObservations(): Promise<DeduplicationResult> {
  console.log('🔄 Deduplicating observations...\n');
  const startTime = Date.now();

  try {
    const beforeCount: QueryResult<CountRow> = await pool.query(
      'SELECT COUNT(*) as count FROM app.observations'
    );
    console.log(`  Initial count: ${parseInt(beforeCount.rows[0].count).toLocaleString()}`);
    console.log('  Finding duplicates...');

    await pool.query(`
      WITH duplicates AS (
        SELECT id,
               ROW_NUMBER() OVER (
                 PARTITION BY bssid, lat, lon, time
                 ORDER BY level DESC NULLS LAST, id
               ) as rn
        FROM app.observations
        WHERE bssid IS NOT NULL
      )
      DELETE FROM app.observations
      WHERE id IN (
        SELECT id FROM duplicates WHERE rn > 1
      )
    `);

    const afterCount: QueryResult<CountRow> = await pool.query(
      'SELECT COUNT(*) as count FROM app.observations'
    );

    const removed = parseInt(beforeCount.rows[0].count) - parseInt(afterCount.rows[0].count);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`  Removed: ${removed.toLocaleString()} duplicates`);
    console.log(`  Final count: ${parseInt(afterCount.rows[0].count).toLocaleString()}`);
    console.log(`\n✅ Deduplication complete in ${duration}s`);

    return {
      before: parseInt(beforeCount.rows[0].count),
      after: parseInt(afterCount.rows[0].count),
      removed,
    };
  } catch (error) {
    console.error('❌ Deduplication failed:', (error as Error).message);
    throw error;
  }
}

async function main() {
  try {
    await normalizeObservations();
    await deduplicateObservations();
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
