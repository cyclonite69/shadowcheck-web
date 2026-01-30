#!/usr/bin/env node
/**
 * Run ML Scoring
 *
 * Triggers ML threat scoring for networks.
 */

import { Pool, QueryResult } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

interface ModelCheckRow {
  has_recent_model: boolean;
}

interface CountRow {
  count: string;
}

interface ScoringResult {
  scored?: number;
}

const pool = new Pool({
  user: process.env.DB_USER || 'shadowcheck_user',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'shadowcheck_db',
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || '5432', 10),
});

export async function runScoring(): Promise<void> {
  console.log('🤖 Running ML threat scoring...\n');
  const startTime = Date.now();

  try {
    // Check if ML model is trained
    const modelCheck: QueryResult<ModelCheckRow> = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM app.ml_model_info
        WHERE updated_at > NOW() - INTERVAL '30 days'
      ) as has_recent_model
    `);

    if (!modelCheck.rows[0].has_recent_model) {
      console.log('⚠️  No recent ML model found. Run model training first:');
      console.log('   curl -X POST http://localhost:3001/api/ml/train');
      return;
    }

    // Get count of networks needing scoring
    const needsScoring: QueryResult<CountRow> = await pool.query(`
      SELECT COUNT(*) as count
      FROM app.networks n
      WHERE NOT EXISTS (
        SELECT 1 FROM app.network_threat_scores s
        WHERE s.bssid = n.bssid
          AND s.scored_at > NOW() - INTERVAL '7 days'
      )
    `);

    console.log(
      `  Networks needing scoring: ${parseInt(needsScoring.rows[0].count).toLocaleString()}`
    );

    // Trigger scoring via API
    console.log('  Triggering ML scoring API...');

    const apiUrl = process.env.API_URL || 'http://localhost:3001';
    const response = await fetch(`${apiUrl}/api/ml/score-all`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (response.ok) {
      const result: ScoringResult = await response.json();
      console.log(`  ✅ Scored ${result.scored || 0} networks`);
    } else {
      console.log(`  ⚠️  Scoring API returned ${response.status}`);
      console.log('     You may need to run scoring manually via the API');
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✅ Scoring complete in ${duration}s`);
  } catch (error) {
    const err = error as { code?: string; message: string };
    if (err.code === 'ECONNREFUSED') {
      console.log('⚠️  API server not running. Start the server and try again.');
    } else {
      console.error('❌ Scoring failed:', err.message);
    }
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  runScoring().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
