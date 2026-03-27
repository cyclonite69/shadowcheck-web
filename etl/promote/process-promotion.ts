#!/usr/bin/env tsx
/**
 * Process Promotion
 *
 * 1. Validates data quality after import
 * 2. Refreshes all materialized views
 * 3. Triggers ML threat scoring
 */

import { QueryResult } from 'pg';
import '../loadEnv';
import { createPool } from '../utils/db';

const pool = createPool();

// --- Validation Types ---
interface CountRow {
  count: string;
}
interface ValidationCheck {
  name: string;
  query: string;
  threshold: number;
  severity: 'error' | 'warning';
}
interface ValidationResult {
  check: string;
  count: number;
  threshold: number;
  passed: boolean;
  severity: 'error' | 'warning';
}

const CHECKS: ValidationCheck[] = [
  {
    name: 'Null coordinates',
    query: 'SELECT COUNT(*) as count FROM app.observations WHERE lat IS NULL OR lon IS NULL',
    threshold: 0,
    severity: 'error',
  },
  {
    name: 'Invalid latitude range',
    query: 'SELECT COUNT(*) as count FROM app.observations WHERE lat < -90 OR lat > 90',
    threshold: 0,
    severity: 'error',
  },
  {
    name: 'Invalid longitude range',
    query: 'SELECT COUNT(*) as count FROM app.observations WHERE lon < -180 OR lon > 180',
    threshold: 0,
    severity: 'error',
  },
  {
    name: 'Null BSSID',
    query: "SELECT COUNT(*) as count FROM app.observations WHERE bssid IS NULL OR bssid = ''",
    threshold: 0,
    severity: 'error',
  },
  {
    name: 'Invalid BSSID format',
    query:
      "SELECT COUNT(*) as count FROM app.observations WHERE bssid !~ '^[0-9A-F]{2}(:[0-9A-F]{2}){5}$'",
    threshold: 100,
    severity: 'warning',
  },
  {
    name: 'Future timestamps',
    query: "SELECT COUNT(*) as count FROM app.observations WHERE time > NOW() + INTERVAL '1 day'",
    threshold: 0,
    severity: 'error',
  },
  {
    name: 'Very old timestamps (before 2000)',
    query: "SELECT COUNT(*) as count FROM app.observations WHERE time < '2000-01-01'",
    threshold: 0,
    severity: 'warning',
  },
  {
    name: 'Signal out of range',
    query: 'SELECT COUNT(*) as count FROM app.observations WHERE level < -120 OR level > 0',
    threshold: 100,
    severity: 'warning',
  },
];

export async function validateData(): Promise<boolean> {
  console.log('🔍 Validating data quality...\n');
  const startTime = Date.now();
  let hasErrors = false;
  let passedChecks = 0;

  try {
    const totalResult: QueryResult<CountRow> = await pool.query(
      'SELECT COUNT(*) as count FROM app.observations'
    );
    console.log(`  Total observations: ${parseInt(totalResult.rows[0].count).toLocaleString()}\n`);

    for (const check of CHECKS) {
      const result: QueryResult<CountRow> = await pool.query(check.query);
      const count = parseInt(result.rows[0].count);
      const passed = count <= check.threshold;
      if (passed) passedChecks++;
      if (!passed && check.severity === 'error') hasErrors = true;

      const icon = passed ? '✅' : check.severity === 'error' ? '❌' : '⚠️';
      console.log(
        `  ${icon} ${check.name}: ${count.toLocaleString()} [${passed ? 'PASS' : check.severity.toUpperCase()}]`
      );
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(
      `\n  Data Quality Score: ${Math.round((passedChecks / CHECKS.length) * 100)}% (${passedChecks}/${CHECKS.length} checks passed in ${duration}s)\n`
    );

    if (hasErrors) {
      console.log('❌ VALIDATION FAILED - Critical errors found\n');
      process.exitCode = 1;
    } else {
      console.log('✅ VALIDATION PASSED\n');
    }
    return !hasErrors;
  } catch (error) {
    console.error('❌ Validation failed:', (error as Error).message);
    throw error;
  }
}

// --- Materialized Views Types ---
interface ExistsRow {
  exists: boolean;
}
interface RefreshRow {
  view_name: string;
  refresh_duration: string | { seconds: number; milliseconds?: number };
}

export async function refreshMaterializedViews(): Promise<void> {
  console.log('🔄 Refreshing Materialized Views...\n');
  const startTime = Date.now();

  try {
    console.log('  Marking quality-filtered observations...');
    const qualityResult = await pool.query<{ total_marked: string; execution_time_ms: string }>(
      'SELECT * FROM app.mark_quality_filtered_observations()'
    );
    console.log(
      `  ✅ Marked ${qualityResult.rows[0].total_marked} observations in ${(parseInt(qualityResult.rows[0].execution_time_ms) / 1000).toFixed(2)}s\n`
    );

    console.log('  Refreshing network computed columns...');
    const computedResult = await pool.query<{
      networks_updated: string;
      execution_time_ms: string;
    }>('SELECT * FROM app.refresh_network_computed_columns()');
    console.log(
      `  ✅ Updated ${computedResult.rows[0].networks_updated} networks in ${(parseInt(computedResult.rows[0].execution_time_ms) / 1000).toFixed(2)}s\n`
    );

    const funcCheck: QueryResult<ExistsRow> = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'refresh_all_materialized_views' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'app')
      ) as exists
    `);

    if (funcCheck.rows[0].exists) {
      console.log('  Using app.refresh_all_materialized_views()...');
      const result: QueryResult<RefreshRow> = await pool.query(
        'SELECT * FROM app.refresh_all_materialized_views()'
      );
      result.rows.forEach((row) => {
        let seconds = 0;
        if (
          typeof row.refresh_duration === 'object' &&
          row.refresh_duration !== null &&
          'seconds' in row.refresh_duration
        ) {
          seconds = row.refresh_duration.seconds + (row.refresh_duration.milliseconds || 0) / 1000;
        } else if (typeof row.refresh_duration === 'string') {
          const match = row.refresh_duration.match(/(\d+\.?\d*)/);
          seconds = match ? parseFloat(match[1]) : 0;
        }
        console.log(`  ✅ ${row.view_name}: ${seconds.toFixed(2)}s`);
      });
    } else {
      console.log('  Refreshing MVs manually...');
      for (const mv of ['app.api_network_explorer_mv', 'app.network_statistics_mv']) {
        try {
          const mvStart = Date.now();
          await pool.query(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${mv}`);
          console.log(`  ✅ ${mv}: ${((Date.now() - mvStart) / 1000).toFixed(2)}s`);
        } catch (err) {
          console.log(`  ❌/⏭️ ${mv}: ${(err as Error).message}`);
        }
      }
    }
    console.log(`\n✅ MV refresh complete in ${((Date.now() - startTime) / 1000).toFixed(2)}s\n`);
  } catch (error) {
    console.error('❌ MV refresh failed:', (error as Error).message);
    throw error;
  }
}

// --- Scoring Types ---
interface ModelCheckRow {
  has_recent_model: boolean;
}
interface ScoringResult {
  scored: number;
  message: string;
  modelVersion?: string;
}

export async function runScoring(): Promise<void> {
  console.log('🤖 Running ML threat scoring...\n');
  const startTime = Date.now();

  try {
    const modelCheck: QueryResult<ModelCheckRow> = await pool.query(`
      SELECT EXISTS (SELECT 1 FROM app.ml_model_info WHERE updated_at > NOW() - INTERVAL '30 days') as has_recent_model
    `);

    if (!modelCheck.rows[0].has_recent_model) {
      console.log('⚠️  No recent ML model found. Run model training via API.');
      return;
    }

    const needsScoring: QueryResult<CountRow> = await pool.query(`
      SELECT COUNT(*) as count FROM app.networks n
      WHERE NOT EXISTS (SELECT 1 FROM app.network_threat_scores s WHERE s.bssid = n.bssid AND s.scored_at > NOW() - INTERVAL '7 days')
    `);
    console.log(
      `  Networks needing scoring: ${parseInt(needsScoring.rows[0].count).toLocaleString()}`
    );
    console.log('  Triggering ML scoring API...');

    const apiUrl = process.env.API_URL || 'http://localhost:3001';
    const response = await fetch(`${apiUrl}/api/ml/score-all`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (response.ok) {
      const result = (await response.json()) as ScoringResult;
      console.log(`  ✅ Scored ${result.scored} networks`);
    } else {
      console.log(`  ⚠️  Scoring API returned ${response.status}`);
    }
    console.log(`\n✅ Scoring complete in ${((Date.now() - startTime) / 1000).toFixed(2)}s\n`);
  } catch (error) {
    const err = error as { code?: string; message: string };
    if (err.code === 'ECONNREFUSED')
      console.log('⚠️  API server not running. Start the server and try again.');
    else console.error('❌ Scoring failed:', err.message);
  }
}

async function main() {
  try {
    const valid = await validateData();
    if (valid) {
      await refreshMaterializedViews();
      await runScoring();
    }
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
