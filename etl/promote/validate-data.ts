#!/usr/bin/env node
/**
 * Validate Data Quality
 *
 * Validates data quality after import:
 * - Coordinate validity (no nulls, valid ranges)
 * - BSSID format (valid MAC addresses)
 * - Timestamp sanity (not in future, not too old)
 * - Signal strength ranges (-120 to 0 dBm)
 */

import { Pool, QueryResult } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

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

interface ValidationSummary {
  totalCount: number;
  qualityScore: number;
  results: ValidationResult[];
  hasErrors: boolean;
}

const pool = new Pool({
  user: process.env.DB_USER || 'shadowcheck_user',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'shadowcheck_db',
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || '5432', 10),
});

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
    threshold: 100, // Allow some legacy formats
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

export async function validateData(): Promise<ValidationSummary> {
  console.log('🔍 Validating data quality...\n');
  const startTime = Date.now();
  const results: ValidationResult[] = [];
  let hasErrors = false;

  try {
    // Get total count
    const totalResult: QueryResult<CountRow> = await pool.query(
      'SELECT COUNT(*) as count FROM app.observations'
    );
    const totalCount = parseInt(totalResult.rows[0].count);
    console.log(`  Total observations: ${totalCount.toLocaleString()}\n`);

    // Run each check
    for (const check of CHECKS) {
      const result: QueryResult<CountRow> = await pool.query(check.query);
      const count = parseInt(result.rows[0].count);
      const passed = count <= check.threshold;

      const icon = passed ? '✅' : check.severity === 'error' ? '❌' : '⚠️';
      const status = passed ? 'PASS' : check.severity.toUpperCase();

      console.log(`  ${icon} ${check.name}: ${count.toLocaleString()} [${status}]`);

      results.push({
        check: check.name,
        count,
        threshold: check.threshold,
        passed,
        severity: check.severity,
      });

      if (!passed && check.severity === 'error') {
        hasErrors = true;
      }
    }

    // Calculate quality score
    const passedChecks = results.filter((r) => r.passed).length;
    const qualityScore = Math.round((passedChecks / CHECKS.length) * 100);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`\n${'─'.repeat(50)}`);
    console.log(`  Data Quality Score: ${qualityScore}%`);
    console.log(`  Checks Passed: ${passedChecks}/${CHECKS.length}`);
    console.log(`  Duration: ${duration}s`);
    console.log(`${'─'.repeat(50)}`);

    if (hasErrors) {
      console.log('\n❌ VALIDATION FAILED - Critical errors found');
      process.exitCode = 1;
    } else {
      console.log('\n✅ VALIDATION PASSED');
    }

    return {
      totalCount,
      qualityScore,
      results,
      hasErrors,
    };
  } catch (error) {
    console.error('❌ Validation failed:', (error as Error).message);
    throw error;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  validateData().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
