const logger = require('../../logging/logger');
const { pool } = require('../../config/database');
const wigleService = require('../wigleService');

const processSuccessfulPage = async (
  runId: number,
  pageNumber: number,
  requestCursor: string | null,
  nextCursor: string | null,
  results: any[],
  apiTotalResults: number | null,
  pageSize: number
) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let rowsInserted = 0;
    for (const network of results) {
      rowsInserted += await wigleService.importWigleV2SearchResult(network, client);
    }

    const totalPages =
      apiTotalResults !== null && apiTotalResults >= 0
        ? Math.max(1, Math.ceil(apiTotalResults / pageSize))
        : null;

    await client.query(
      `INSERT INTO app.wigle_import_run_pages (
          run_id, page_number, request_cursor, next_cursor, rows_returned, rows_inserted, success, error_message, fetched_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, TRUE, NULL, NOW(), NOW())
        ON CONFLICT (run_id, page_number) DO UPDATE
          SET request_cursor = EXCLUDED.request_cursor,
              next_cursor = EXCLUDED.next_cursor,
              rows_returned = EXCLUDED.rows_returned,
              rows_inserted = EXCLUDED.rows_inserted,
              success = TRUE,
              error_message = NULL,
              fetched_at = NOW(),
              updated_at = NOW()`,
      [runId, pageNumber, requestCursor, nextCursor, results.length, rowsInserted]
    );

    const runResult = await client.query(
      `UPDATE app.wigle_import_runs
          SET api_total_results = COALESCE($2, api_total_results),
              page_size = $3,
              total_pages = COALESCE($4, total_pages),
              last_successful_page = GREATEST(last_successful_page, $5),
              next_page = GREATEST(next_page, $5 + 1),
              pages_fetched = (
                SELECT COUNT(*)
                FROM app.wigle_import_run_pages
                WHERE run_id = $1 AND success = TRUE
              ),
              rows_returned = (
                SELECT COALESCE(SUM(rows_returned), 0)
                FROM app.wigle_import_run_pages
                WHERE run_id = $1 AND success = TRUE
              ),
              rows_inserted = (
                SELECT COALESCE(SUM(rows_inserted), 0)
                FROM app.wigle_import_run_pages
                WHERE run_id = $1 AND success = TRUE
              ),
              api_cursor = $6,
              last_attempted_at = NOW(),
              last_error = NULL,
              updated_at = NOW()
        WHERE id = $1
        RETURNING *`,
      [runId, apiTotalResults, pageSize, totalPages, pageNumber, nextCursor]
    );

    await client.query('COMMIT');
    logger.info('[WiGLE Import] Page committed', {
      runId,
      pageNumber,
      rowsReturned: results.length,
      rowsInserted,
      nextCursor,
    });
    return runResult.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export { processSuccessfulPage };
