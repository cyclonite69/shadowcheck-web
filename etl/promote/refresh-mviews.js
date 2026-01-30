#!/usr/bin/env node
/**
 * Refresh Materialized Views
 *
 * Refreshes all materialized views after data import.
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'shadowcheck_user',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'shadowcheck_db',
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

async function refreshMaterializedViews() {
  console.log('🔄 Refreshing Materialized Views...\n');
  const startTime = Date.now();

  try {
    // Check if the refresh function exists
    const funcCheck = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_proc
        WHERE proname = 'refresh_all_materialized_views'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'app')
      ) as exists
    `);

    if (funcCheck.rows[0].exists) {
      // Use the existing function
      console.log('  Using app.refresh_all_materialized_views()...\n');
      const result = await pool.query('SELECT * FROM app.refresh_all_materialized_views()');

      result.rows.forEach((row) => {
        const duration = row.refresh_duration;
        let seconds = 0;

        if (typeof duration === 'object' && duration.seconds !== undefined) {
          seconds = duration.seconds + (duration.milliseconds || 0) / 1000;
        } else if (typeof duration === 'string') {
          const match = duration.match(/(\d+\.?\d*)/);
          seconds = match ? parseFloat(match[1]) : 0;
        }

        console.log(`  ✅ ${row.view_name}: ${seconds.toFixed(2)}s`);
      });
    } else {
      // Fallback: manually refresh known MVs
      console.log('  Refreshing MVs manually...\n');

      const mvs = ['app.api_network_explorer_mv', 'app.network_statistics_mv'];

      for (const mv of mvs) {
        try {
          const mvStart = Date.now();
          await pool.query(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${mv}`);
          const mvDuration = ((Date.now() - mvStart) / 1000).toFixed(2);
          console.log(`  ✅ ${mv}: ${mvDuration}s`);
        } catch (err) {
          if (err.message.includes('does not exist')) {
            console.log(`  ⏭️  ${mv}: skipped (does not exist)`);
          } else {
            console.log(`  ❌ ${mv}: ${err.message}`);
          }
        }
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✅ MV refresh complete in ${duration}s`);
  } catch (error) {
    console.error('❌ MV refresh failed:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  refreshMaterializedViews().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { refreshMaterializedViews };
