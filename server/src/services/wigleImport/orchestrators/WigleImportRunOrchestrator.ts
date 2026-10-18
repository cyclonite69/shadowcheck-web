import logger from '../../../logging/logger';
import {
  completeRun,
  getRunOrThrow,
  markRunControlStatus,
  markRunFailure,
  persistPageFailure,
  reconcileRunProgress,
} from '../runRepository';
import { DEFAULT_RESULTS_PER_PAGE, normalizeImportParams } from '../params';
import { processSuccessfulPage } from '../pageProcessor';
import { getEncodedWigleAuth } from '../authProvider';
import { getAdaptiveDelay, sleep } from '../rateLimitingStrategy';
import { fetchWiglePage, type WiglePageResponse } from '../wigleApiClient';

/**
 * Backoff duration for transient network/timeout retries.
 * Distinct from adaptive-delay values (which pace inter-page requests).
 */
export const TRANSIENT_RETRY_BACKOFF_MS = 15_000;

export function getMaxTransientRetries(): number {
  const envVal = process.env.WIGLE_IMPORT_TRANSIENT_RETRIES;
  if (envVal !== undefined && envVal !== '') {
    const parsed = Number(envVal);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  }
  return 1;
}

export function isLocalSoftLimitError(error: any): boolean {
  return (
    error?.status === 429 &&
    typeof error?.message === 'string' &&
    /soft limit reached/i.test(error.message)
  );
}

export function isTransientError(error: any): boolean {
  if (isLocalSoftLimitError(error)) {
    return false;
  }
  if (error?.status === 401 || error?.status === 403) {
    return false;
  }
  if (error?.isTimeout || error?.name === 'AbortError') {
    return true;
  }
  const status = error?.status;
  if (status === 502 || status === 503 || status === 504) {
    return true;
  }
  const code = error?.code;
  if (code === 'ECONNRESET' || code === 'ETIMEDOUT' || code === 'UND_ERR_CONNECT_TIMEOUT') {
    return true;
  }
  if (typeof error?.message === 'string' && /timeout after/i.test(error.message)) {
    return true;
  }
  return false;
}

/**
 * Coordinates the long-running WiGLE import loop.
 * This class owns retry behavior, page lifecycle, and terminal run-state transitions.
 */
export class WigleImportRunOrchestrator {
  /**
   * Execute the paginated import loop for one persisted run.
   */
  async execute(runId: number) {
    const encodedAuth = getEncodedWigleAuth();
    let run = (await reconcileRunProgress(runId)) ?? (await getRunOrThrow(runId));

    if (run.status === 'completed' || run.status === 'cancelled') {
      return run;
    }

    const requestParams = normalizeImportParams(run.request_params || {});

    for (;;) {
      run = await getRunOrThrow(runId);

      if (run.status === 'paused' || run.status === 'cancelled') {
        logger.info('[WiGLE Import] Run stopped by operator', { runId, status: run.status });
        return run;
      }

      const pageNumber = Number(run.next_page || 1);
      const requestCursor = run.api_cursor || null;

      logger.info('[WiGLE Import] Fetching page', {
        runId,
        pageNumber,
        requestCursor,
        state: run.state,
        searchTerm: run.search_term,
      });

      try {
        const data = await this.fetchPageWithRetry(
          encodedAuth,
          requestParams,
          requestCursor,
          runId,
          pageNumber
        );

        const results = Array.isArray(data?.results) ? data.results : [];
        const liveTotal =
          data?.totalResults !== undefined && data?.totalResults !== null
            ? Number(data.totalResults)
            : null;
        const totalResults =
          liveTotal ?? (run.api_total_results !== null ? Number(run.api_total_results) : null);
        const nextCursor =
          data?.search_after !== undefined && data?.search_after !== null
            ? String(data.search_after)
            : null;
        const pageSize = requestParams.resultsPerPage || DEFAULT_RESULTS_PER_PAGE;

        this.assertPaginationMetadata(
          pageNumber,
          pageSize,
          results.length,
          totalResults,
          nextCursor
        );

        if (results.length === 0 && nextCursor === null) {
          const note =
            pageNumber === 1
              ? 'No records returned on first page — API quota may be exhausted or no results match the search'
              : undefined;
          return completeRun(runId, note);
        }

        const totalPages =
          totalResults !== null ? Math.max(1, Math.ceil(totalResults / pageSize)) : null;
        const isComplete =
          nextCursor === null &&
          (totalPages === null || pageNumber >= totalPages || results.length < pageSize);

        run = await processSuccessfulPage(
          runId,
          pageNumber,
          requestCursor,
          nextCursor,
          results,
          liveTotal,
          pageSize,
          isComplete
        );

        if (isComplete) {
          return run;
        }

        await sleep(getAdaptiveDelay());
      } catch (error: any) {
        return this.handlePageFailure(runId, pageNumber, requestCursor, error);
      }
    }
  }

  private async fetchPageWithRetry(
    encodedAuth: string,
    requestParams: ReturnType<typeof normalizeImportParams>,
    requestCursor: string | null,
    runId: number,
    pageNumber: number
  ): Promise<WiglePageResponse> {
    const maxTransientRetries = getMaxTransientRetries();
    let transientAttempt = 0;

    for (;;) {
      try {
        return await fetchWiglePage(encodedAuth, requestParams, requestCursor);
      } catch (error: any) {
        if (error?.status === 401 || error?.status === 403) {
          logger.error('[WiGLE Import] AUTH ERROR — halting pipeline, do not retry', {
            runId,
            pageNumber,
            status: error?.status,
            details: String(error?.details || error?.message || '').slice(0, 500),
          });
          throw error;
        }

        // Local soft limit is never transient and should not be retried with extra sleep
        if (isLocalSoftLimitError(error)) {
          logger.warn('[WiGLE Import] Local soft limit reached — pausing without retry', {
            runId,
            pageNumber,
          });
          throw error;
        }

        // Upstream rate limit (429)
        if (error?.status === 429) {
          const delayMs = WigleImportRunOrchestrator.computeRetryDelayMs(error?.retryAfter);
          logger.warn('[WiGLE Import] Rate limited (429) — waiting then retrying once', {
            runId,
            pageNumber,
            delayMs,
            retryAfter: error?.retryAfter ?? null,
          });
          await sleep(delayMs);

          const currentRun = await getRunOrThrow(runId);
          if (currentRun.status === 'paused' || currentRun.status === 'cancelled') {
            const stopErr: any = new Error(`Run ${currentRun.status} during rate-limit backoff`);
            stopErr.isStopped = true;
            stopErr.run = currentRun;
            throw stopErr;
          }

          try {
            return await fetchWiglePage(encodedAuth, requestParams, requestCursor);
          } catch (retryError: any) {
            if (retryError?.status === 429) {
              logger.error('[WiGLE Import] Rate limited again after single retry — halting run', {
                runId,
                pageNumber,
                retryAfter: retryError?.retryAfter ?? null,
                details: String(retryError?.details || retryError?.message || '').slice(0, 500),
              });
            }
            throw retryError;
          }
        }

        // Transient error handling (timeout, 502/503/504, network reset)
        // NOTE: Each retry sends a search request to WiGLE and consumes 1/50th of the rolling 24h search quota.
        // Retries are strictly bounded by WIGLE_IMPORT_TRANSIENT_RETRIES (default 1) to prevent quota exhaustion.
        if (isTransientError(error) && transientAttempt < maxTransientRetries) {
          transientAttempt++;
          logger.warn(
            `[WiGLE Import] Transient error (${error?.message}) — waiting ${TRANSIENT_RETRY_BACKOFF_MS}ms before retry (${transientAttempt}/${maxTransientRetries})`,
            {
              runId,
              pageNumber,
              attempt: transientAttempt,
              maxRetries: maxTransientRetries,
              error: error?.message,
            }
          );

          await sleep(TRANSIENT_RETRY_BACKOFF_MS);

          const currentRun = await getRunOrThrow(runId);
          if (currentRun.status === 'paused' || currentRun.status === 'cancelled') {
            logger.info('[WiGLE Import] Run stopped by operator during backoff', {
              runId,
              status: currentRun.status,
            });
            const stopErr: any = new Error(`Run ${currentRun.status} during backoff`);
            stopErr.isStopped = true;
            stopErr.run = currentRun;
            throw stopErr;
          }

          continue;
        }

        if (isTransientError(error)) {
          error.isTransient = true;
        }

        throw error;
      }
    }
  }

  private assertPaginationMetadata(
    pageNumber: number,
    pageSize: number,
    resultCount: number,
    totalResults: number | null,
    nextCursor: string | null
  ) {
    if (totalResults !== null && Number.isFinite(totalResults) && totalResults >= 0) {
      const expectedPages = Math.max(1, Math.ceil(totalResults / pageSize));
      if (pageNumber > expectedPages && resultCount > 0) {
        throw new Error(
          `WiGLE pagination metadata mismatch: page ${pageNumber} exceeded expected page count ${expectedPages}`
        );
      }
    }

    if (resultCount === 0 && nextCursor) {
      throw new Error(
        `WiGLE pagination metadata inconsistent: empty page ${pageNumber} returned with a next cursor`
      );
    }
  }

  private async handlePageFailure(
    runId: number,
    pageNumber: number,
    requestCursor: string | null,
    error: any
  ) {
    if (error?.isStopped) {
      return error.run ?? getRunOrThrow(runId);
    }

    const errorMessage = error?.details || error?.message || 'WiGLE import page failed';
    await persistPageFailure(runId, pageNumber, requestCursor, errorMessage);

    if (error?.status === 401 || error?.status === 403) {
      return markRunFailure(runId, errorMessage);
    }

    if (error?.status === 429) {
      const run = await markRunControlStatus(runId, 'paused');
      logger.warn('[WiGLE Import] Daily quota exhausted — run paused for later resumption', {
        runId,
        pageNumber,
      });
      return run;
    }

    if (error?.isTransient) {
      const run = await markRunControlStatus(runId, 'paused', errorMessage);
      logger.warn(
        '[WiGLE Import] Transient failure retries exhausted — run paused for later resumption',
        {
          runId,
          pageNumber,
          error: errorMessage,
        }
      );
      return run;
    }

    return markRunFailure(runId, errorMessage);
  }

  private static computeRetryDelayMs(retryAfterRaw: unknown): number {
    const fallbackMs = 60_000;
    const raw = typeof retryAfterRaw === 'string' ? retryAfterRaw.trim() : '';
    const parsed = raw ? Number.parseInt(raw, 10) : NaN;
    const baseMs = Number.isFinite(parsed) && parsed > 0 ? parsed * 1000 : fallbackMs;
    const jitterMs = Math.floor(baseMs * (Math.random() * 0.1));
    return baseMs + jitterMs;
  }
}
