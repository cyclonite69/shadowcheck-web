export {};

const { query, pool } = require('../config/database');

export async function checkHomeLocationExists(): Promise<boolean> {
  try {
    const home = await query(
      "SELECT 1 FROM app.location_markers WHERE marker_type = 'home' LIMIT 1"
    );
    return home.rowCount > 0;
  } catch (err: any) {
    if (err && err.code === '42P01') {
      throw new (Error as any)('Home location markers table is missing (app.location_markers).', {
        cause: err,
      });
    }
    throw err;
  }
}

export async function executeKeplerQuery(sql: string, params: any[]): Promise<any> {
  await query("SET LOCAL statement_timeout = '120000ms'");
  return query(sql, params);
}

export async function streamKeplerQuery(
  sql: string,
  params: any[],
  batchSize: number,
  onChunk: (rows: any[]) => Promise<void> | void,
  signal?: AbortSignal
): Promise<number> {
  const client = await pool.connect();
  let cursorOpened = false;
  let totalRows = 0;
  const cursorName = 'kepler_cur';

  try {
    if (signal?.aborted) {
      return 0;
    }

    await client.query('BEGIN READ ONLY');
    await client.query("SET LOCAL statement_timeout = '300000ms'");
    await client.query(`DECLARE ${cursorName} NO SCROLL CURSOR FOR ${sql}`, params);
    cursorOpened = true;

    while (true) {
      if (signal?.aborted) {
        break;
      }

      const batchRes = await client.query(`FETCH ${batchSize} FROM ${cursorName}`);
      if (!batchRes.rows || batchRes.rows.length === 0) {
        break;
      }

      totalRows += batchRes.rows.length;
      await onChunk(batchRes.rows);

      if (batchRes.rows.length < batchSize) {
        break;
      }
    }

    if (signal?.aborted) {
      if (cursorOpened) {
        try {
          await client.query(`CLOSE ${cursorName}`);
        } catch {
          // ignore error on close if aborting
        }
      }
      await client.query('ROLLBACK');
    } else {
      await client.query(`CLOSE ${cursorName}`);
      await client.query('COMMIT');
    }

    return totalRows;
  } catch (err: any) {
    if (cursorOpened) {
      try {
        await client.query(`CLOSE ${cursorName}`);
      } catch {
        // ignore error on close
      }
    }
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore error on rollback
    }
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { checkHomeLocationExists, executeKeplerQuery, streamKeplerQuery };
