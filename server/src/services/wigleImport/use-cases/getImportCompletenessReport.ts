import { getImportCompletenessSummary } from '../runRepository';

type ImportCompletenessOptions = {
  searchTerm?: string;
  state?: string;
};

type LedgerStatus = 'known' | 'unknown' | 'rate_limited' | 'error';

const numberOrNull = (value: unknown): number | null =>
  value === null || value === undefined ? null : Number(value);

const getLedgerStatus = (row: any, knownRemoteAvailable: number | null): LedgerStatus => {
  const httpStatus = numberOrNull(row.ledger_http_status);
  const hasLedgerOutcome =
    row.ledger_status !== null && row.ledger_status !== undefined
      ? true
      : httpStatus !== null || Boolean(row.ledger_requested_at);
  if (row.ledger_status === 'rate_limited' || httpStatus === 429) {
    return 'rate_limited';
  }
  if (
    row.ledger_status === 'error' ||
    (httpStatus !== null && httpStatus >= 400) ||
    row.ledger_error ||
    (!hasLedgerOutcome && row.status === 'failed' && row.last_error)
  ) {
    return 'error';
  }
  return knownRemoteAvailable === null ? 'unknown' : 'known';
};

/**
 * Map raw completeness rows into the API report contract used by the admin routes.
 */
export const getImportCompletenessReport = async (options: ImportCompletenessOptions) => {
  const rows = await getImportCompletenessSummary(options);

  return {
    generatedAt: new Date().toISOString(),
    states: rows.map((row: any) => {
      const localUniqueBssids = Number(row.local_unique_bssids || 0);
      const knownRemoteAvailable = numberOrNull(row.api_total_results);
      const ledgerStatus = getLedgerStatus(row, knownRemoteAvailable);
      return {
        state: row.state,
        localRows: Number(row.local_rows || 0),
        localUniqueBssids,
        storedCount: Number(row.local_unique_bssids ?? row.stored_count ?? 0),
        knownRemoteAvailable,
        gap:
          knownRemoteAvailable === null
            ? null
            : Math.max(knownRemoteAvailable - localUniqueBssids, 0),
        lastLedgerProbeAt:
          row.ledger_requested_at ||
          (knownRemoteAvailable !== null ? row.updated_at || null : null),
        lastLedgerHttpStatus: numberOrNull(row.ledger_http_status),
        lastLedgerResultCount: numberOrNull(row.ledger_result_count),
        lastLedgerRetryAfterHint: numberOrNull(row.ledger_retry_after_hint),
        lastLedgerError:
          row.ledger_error || (ledgerStatus === 'error' ? row.last_error || null : null),
        ledgerStatus,
        runId: row.run_id === null ? null : Number(row.run_id),
        searchTerm: row.search_term || null,
        requestParams: row.request_params || null,
        requestFingerprint: row.request_fingerprint || null,
        status: row.status || null,
        apiTotalResults: knownRemoteAvailable,
        totalPages: numberOrNull(row.total_pages),
        pageSize: numberOrNull(row.page_size),
        pagesFetched: numberOrNull(row.pages_fetched),
        rowsReturned: numberOrNull(row.rows_returned),
        rowsInserted: numberOrNull(row.rows_inserted),
        lastSuccessfulPage: numberOrNull(row.last_successful_page),
        nextPage: numberOrNull(row.next_page),
        apiCursor: row.api_cursor || null,
        lastError: row.last_error || null,
        startedAt: row.started_at || null,
        updatedAt: row.updated_at || null,
        completedAt: row.completed_at || null,
        missingApiRows: numberOrNull(row.missing_api_rows),
        missingInsertRows: numberOrNull(row.missing_insert_rows),
        resumable: row.status ? ['running', 'paused', 'failed'].includes(row.status) : false,
      };
    }),
  };
};
