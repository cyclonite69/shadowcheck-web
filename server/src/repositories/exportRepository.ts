export {};

const db = require('../config/database');
const { pool } = db;
const { adminQuery } = require('../services/adminDbService');

const quoteIdent = (identifier: string): string => `"${identifier.replace(/"/g, '""')}"`;

export async function queryObservationsForCSV(): Promise<any[]> {
  const result = await db.query(`
    SELECT
      bssid,
      ssid,
      lat as latitude,
      lon as longitude,
      level as signal_dbm,
      time as observed_at,
      radio_type,
      radio_frequency as frequency,
      radio_capabilities as capabilities,
      accuracy
    FROM app.observations
    ORDER BY time DESC
    LIMIT 50000
  `);
  return result.rows;
}

export async function queryObservationsForJSON(): Promise<any[]> {
  const result = await db.query(`
    SELECT
      bssid,
      ssid,
      lat,
      lon,
      level,
      time,
      radio_type,
      radio_frequency,
      radio_capabilities,
      accuracy,
      altitude
    FROM app.observations
    ORDER BY time DESC
    LIMIT 20000
  `);
  return result.rows;
}

export async function queryNetworksForJSON(): Promise<any[]> {
  const result = await db.query(`
    SELECT
      bssid,
      ssid,
      type,
      lasttime_ms,
      bestlat,
      bestlon,
      frequency,
      capabilities,
      threat_score_v2 as threat_score,
      threat_level
    FROM app.networks
    ORDER BY lasttime_ms DESC NULLS LAST
    LIMIT 10000
  `);
  return result.rows;
}

export async function queryObservationsForGeoJSON(): Promise<any[]> {
  const result = await db.query(`
    SELECT
      bssid,
      ssid,
      lat as latitude,
      lon as longitude,
      level as signal_dbm,
      time as observed_at,
      radio_type,
      radio_frequency as frequency,
      radio_capabilities as capabilities,
      accuracy
    FROM app.observations
    WHERE lat IS NOT NULL AND lon IS NOT NULL
    ORDER BY time DESC
    LIMIT 50000
  `);
  return result.rows;
}

/**
 * Acquires a client connection from the database pool for export streaming.
 */
export async function acquireExportClient(): Promise<any> {
  return pool.connect();
}

/**
 * Streams all observations from app.observations using a PostgreSQL cursor.
 * Implemented as an async generator that yields rows in batches without accumulating all rows in memory.
 * Employs a read-only transaction and sets statement_timeout to 300000ms and idle_in_transaction_session_timeout to 120s.
 * On cancellation, error, or completion, closes the cursor and releases the client connection back to the pool.
 *
 * @param clientOrBatchSize - Pre-acquired DB pool client OR batch size number
 * @param batchSizeOrSignal - Batch size number OR optional AbortSignal
 * @param maybeSignal - Optional AbortSignal when client is passed as first argument
 * @yields Array of observation records for each fetched batch
 */
export async function* streamObservationsForGeoJSON(
  clientOrBatchSize?: any,
  batchSizeOrSignal?: any,
  maybeSignal?: AbortSignal
): AsyncGenerator<any[], void, unknown> {
  let client: any;
  let batchSize: number;
  let signal: AbortSignal | undefined;

  if (clientOrBatchSize && typeof clientOrBatchSize.query === 'function') {
    client = clientOrBatchSize;
    batchSize = typeof batchSizeOrSignal === 'number' ? batchSizeOrSignal : 5000;
    signal = maybeSignal;
  } else {
    batchSize = typeof clientOrBatchSize === 'number' ? clientOrBatchSize : 5000;
    signal = batchSizeOrSignal;
    client = await pool.connect();
  }

  let cursorOpened = false;
  let cursorClosed = false;
  let txEnded = false;
  const cursorName = `geojson_all_cur_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  const closeCursorAndRollback = async () => {
    if (cursorOpened && !cursorClosed) {
      cursorClosed = true;
      try {
        await client.query(`CLOSE ${cursorName}`);
      } catch {
        // ignore error on close
      }
    }
    if (!txEnded) {
      txEnded = true;
      try {
        await client.query('ROLLBACK');
      } catch {
        // ignore error on rollback
      }
    }
  };

  try {
    if (signal?.aborted) {
      return;
    }

    await client.query('BEGIN READ ONLY');
    await client.query("SET LOCAL statement_timeout = '300000ms'");
    await client.query("SET LOCAL idle_in_transaction_session_timeout = '120s'");

    const sql = `
      DECLARE ${cursorName} NO SCROLL CURSOR FOR
      SELECT
        bssid,
        ssid,
        lat as latitude,
        lon as longitude,
        level as signal_dbm,
        time as observed_at,
        radio_type,
        radio_frequency as frequency,
        radio_capabilities as capabilities,
        accuracy
      FROM app.observations
    `;
    await client.query(sql);
    cursorOpened = true;

    while (true) {
      if (signal?.aborted) {
        break;
      }

      const batchRes = await client.query(`FETCH ${batchSize} FROM ${cursorName}`);
      if (!batchRes.rows || batchRes.rows.length === 0) {
        break;
      }

      yield batchRes.rows;

      if (batchRes.rows.length < batchSize) {
        break;
      }
    }

    if (signal?.aborted) {
      await closeCursorAndRollback();
    } else {
      cursorClosed = true;
      try {
        await client.query(`CLOSE ${cursorName}`);
      } catch {
        // ignore error on close
      }
      txEnded = true;
      await client.query('COMMIT');
    }
  } catch (err: any) {
    await closeCursorAndRollback();
    throw err;
  } finally {
    await closeCursorAndRollback();
    client.release();
  }
}

export async function queryAppTableNames(): Promise<string[]> {
  const result = await adminQuery(
    `
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'app'
      ORDER BY tablename
    `
  );
  return result.rows.map((row: any) => String(row.tablename));
}

export async function queryTableRowCount(tableName: string): Promise<number> {
  const qualifiedTable = `${quoteIdent('app')}.${quoteIdent(tableName)}`;
  const result = await adminQuery(`SELECT COUNT(*)::bigint AS count FROM ${qualifiedTable}`);
  return Number(result.rows[0]?.count || 0);
}

export async function queryTableRows(tableName: string, limit: number): Promise<any[]> {
  if (limit <= 0) {
    return [];
  }
  const qualifiedTable = `${quoteIdent('app')}.${quoteIdent(tableName)}`;
  const result = await adminQuery(`SELECT * FROM ${qualifiedTable} LIMIT ${limit}`);
  return Array.isArray(result.rows) ? result.rows : [];
}

export async function queryObservationsForKML(bssids: string[]): Promise<any[]> {
  const placeholders = bssids.map((_, i) => `$${i + 1}`).join(',');
  const result = await db.query(
    `
    SELECT
      bssid,
      ssid,
      lat,
      lon,
      level as signal_dbm,
      time as observed_at,
      radio_type,
      radio_frequency as frequency,
      radio_capabilities as capabilities,
      accuracy,
      altitude
    FROM app.observations
    WHERE bssid IN (${placeholders})
      AND lat IS NOT NULL
      AND lon IS NOT NULL
    ORDER BY time DESC
    LIMIT 10000
  `,
    bssids
  );
  return result.rows;
}

module.exports = {
  acquireExportClient,
  queryObservationsForCSV,
  queryObservationsForJSON,
  queryNetworksForJSON,
  queryObservationsForGeoJSON,
  streamObservationsForGeoJSON,
  queryAppTableNames,
  queryTableRowCount,
  queryTableRows,
  queryObservationsForKML,
};
