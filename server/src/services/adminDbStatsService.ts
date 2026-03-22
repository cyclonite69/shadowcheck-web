export {};

const { adminQuery } = require('./adminDbService');
const logger = require('../logging/logger');

/**
 * Fetch detailed database statistics including row counts, storage size, and activity metrics
 */
async function getDetailedDatabaseStats(): Promise<any> {
  try {
    // 1. Get Global DB Size
    const sizeResult = await adminQuery(
      "SELECT pg_size_pretty(pg_database_size('shadowcheck_db')) as total_size"
    );
    const totalDbSize = sizeResult.rows[0]?.total_size || 'Unknown';

    // 2. Get Per-Table Metrics (Activity + Size)
    const { rows: tableStats } = await adminQuery(`
      SELECT 
        relname as table_name,
        n_live_tup as row_count,
        pg_total_relation_size(relid) as size_bytes,
        pg_size_pretty(pg_total_relation_size(relid)) as size_pretty,
        n_tup_ins as total_inserts,
        n_tup_upd as total_updates,
        n_tup_del as total_deletes,
        COALESCE(last_analyze, last_autoanalyze) as last_active,
        idx_scan as index_reads,
        seq_scan as sequential_reads
      FROM pg_stat_user_tables 
      WHERE schemaname = 'app'
      ORDER BY pg_total_relation_size(relid) DESC
    `);

    // 3. Categorize results for the frontend
    const categories = {
      core: ['networks', 'observations', 'access_points', 'device_sources'],
      wigle: ['wigle_v2_networks_search', 'wigle_v3_network_details', 'wigle_v3_observations'],
      kismet: [
        'kismet_devices',
        'kismet_packets',
        'kismet_alerts',
        'kismet_data',
        'kismet_datasources',
        'kismet_messages',
        'kismet_snapshots',
      ],
      infra: ['settings', 'schema_migrations', 'import_history', 'geocoding_cache', 'ai_insights'],
    };

    // 4. Get Materialized View Health
    const { rows: mvStats } = await adminQuery(`
      SELECT 
        m.matviewname as view_name,
        m.ispopulated as is_populated,
        pg_size_pretty(pg_total_relation_size(quote_ident(m.schemaname) || '.' || quote_ident(m.matviewname))) as size_pretty,
        s.seq_scan,
        s.seq_tup_read,
        COALESCE(s.last_analyze, s.last_autoanalyze) as last_active
      FROM pg_matviews m
      LEFT JOIN pg_stat_user_tables s ON s.relname = m.matviewname AND s.schemaname = m.schemaname
      WHERE m.schemaname = 'app'
      ORDER BY m.matviewname ASC
    `);

    // 5. Get Unused Index Report
    const { rows: unusedIndexes } = await adminQuery(`
      SELECT 
        schemaname || '.' || relname as table_name,
        indexrelname as index_name,
        idx_scan as scan_count,
        pg_size_pretty(pg_relation_size(indexrelid)) as size_pretty,
        pg_relation_size(indexrelid) as size_bytes
      FROM pg_stat_user_indexes
      WHERE schemaname = 'app'
        AND idx_scan = 0
        AND indexrelname NOT LIKE '%_pkey'
        AND indexrelname NOT LIKE '%_id_key'
      ORDER BY pg_relation_size(indexrelid) DESC
    `);

    return {
      success: true,
      total_db_size: totalDbSize,
      tables: tableStats,
      categories,
      materialized_views: mvStats,
      unused_indexes: unusedIndexes,
    };
  } catch (e: any) {
    logger.error('Failed to fetch detailed DB stats', { error: e.message });
    throw e;
  }
}

module.exports = {
  getDetailedDatabaseStats,
};
