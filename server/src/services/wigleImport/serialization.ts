import { DEFAULT_RESULTS_PER_PAGE } from './params';

const computeProgress = (row: any) => {
  const apiTotalResults = row.api_total_results === null ? null : Number(row.api_total_results);
  const totalPages = row.total_pages === null ? null : Number(row.total_pages);
  const rowsReturned = Number(row.rows_returned || 0);
  const rowsInserted = Number(row.rows_inserted || 0);
  const pagesFetched = Number(row.pages_fetched || 0);
  const rowCompletenessPct =
    apiTotalResults && apiTotalResults > 0
      ? Number(((rowsReturned / apiTotalResults) * 100).toFixed(2))
      : null;
  const insertedRowCompletenessPct =
    apiTotalResults && apiTotalResults > 0
      ? Number(((rowsInserted / apiTotalResults) * 100).toFixed(2))
      : null;
  const pageCompletenessPct =
    totalPages && totalPages > 0 ? Number(((pagesFetched / totalPages) * 100).toFixed(2)) : null;

  return {
    apiTotalResults,
    totalPages,
    pageSize: Number(row.page_size || DEFAULT_RESULTS_PER_PAGE),
    pagesFetched,
    rowsReturned,
    rowsInserted,
    rowCompletenessPct,
    insertedRowCompletenessPct,
    pageCompletenessPct,
    rowCompletenessNote:
      'rowsReturned tracks API rows successfully paged; rowsInserted can be lower because duplicate-safe upserts skip already imported rows.',
  };
};

const serializeRun = (row: any, pages: any[] = []) => ({
  id: Number(row.id),
  source: row.source,
  apiVersion: row.api_version,
  searchTerm: row.search_term,
  state: row.state,
  requestFingerprint: row.request_fingerprint,
  requestParams: row.request_params || {},
  status: row.status,
  apiCursor: row.api_cursor,
  lastError: row.last_error,
  startedAt: row.started_at,
  lastAttemptedAt: row.last_attempted_at,
  completedAt: row.completed_at,
  lastSuccessfulPage: Number(row.last_successful_page || 0),
  nextPage: Number(row.next_page || 1),
  ...computeProgress(row),
  pages: pages.map((page) => ({
    id: Number(page.id),
    pageNumber: Number(page.page_number),
    requestCursor: page.request_cursor,
    nextCursor: page.next_cursor,
    fetchedAt: page.fetched_at,
    rowsReturned: Number(page.rows_returned || 0),
    rowsInserted: Number(page.rows_inserted || 0),
    success: Boolean(page.success),
    errorMessage: page.error_message || null,
  })),
});

export { computeProgress, serializeRun };
