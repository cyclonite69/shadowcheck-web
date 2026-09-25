/**
 * WiGLE Gateway
 * Single auditable exit point for all outbound WiGLE API calls.
 * Wraps wigleClient.ts with typed request/response, structured logging,
 * and search-param validation via wigleApiSpec.ts.
 */

import logger from '../../logging/logger';
import { fetchWigle } from '../wigleClient';
import { validateWigleSearchParams, WigleValidationError } from '../wigleImport/wigleApiSpec';
import { logWigleAuditEvent } from '../wigleAuditLogger';
import { hashRecord } from '../wigleRequestUtils';
import { assertCanRequest, updateLedgerOutcome } from '../wigleRequestLedger';

/** Parse a Retry-After header value into seconds, returns null if absent or unparseable. */
function parseRetryAfter(raw: string | null): number | null {
  if (!raw) {
    return null;
  }
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export type WigleRequestKind = 'search' | 'detail' | 'stats';

export interface WigleGatewayRequest {
  kind: WigleRequestKind;
  url: string;
  init?: RequestInit;
  timeoutMs?: number;
  maxRetries?: number;
  label?: string;
  priority?: 'interactive' | 'background';
  entrypoint?: string;
  endpointType?: string;
  query_source?: string;
  /** If provided, params are validated against the v2 search spec before the request is sent. */
  searchParams?: URLSearchParams;
}

export type WigleGatewayResult =
  | { ok: true; response: Response; latencyMs: number; ledgerId: number | null }
  | { ok: false; error: string; status?: number; validationError?: boolean };

/**
 * Send a single outbound request to the WiGLE API through the gateway.
 * Never throws — returns a structured result.
 */
export async function wigleGatewayFetch(req: WigleGatewayRequest): Promise<WigleGatewayResult> {
  const { kind, url, init, searchParams, entrypoint = 'gateway', endpointType } = req;
  const paramsHash = hashRecord({ url, kind });

  // Validate search params before sending (search calls only)
  if (searchParams) {
    try {
      validateWigleSearchParams(searchParams);
    } catch (err) {
      if (err instanceof WigleValidationError) {
        logger.error('[WiGLE Gateway] Param validation blocked request', {
          invalidKey: err.invalidKey,
          invalidValue: err.invalidValue,
          url,
        });
        logWigleAuditEvent({
          entrypoint,
          endpointType: endpointType ?? kind,
          paramsHash,
          status: 'VALIDATION_ERROR',
          latencyMs: 0,
          servedFromCache: false,
          retryCount: 0,
          kind,
        });
        return { ok: false, error: err.message, validationError: true };
      }
      throw err;
    }
  }

  // Stats (profile/user, /stats, etc.): enforce soft limit and circuit breaker here so
  // every caller — including interactive HTTP routes — shares one counter before fetchWigle.
  if (kind === 'stats') {
    const priority = req.priority ?? 'background';
    try {
      assertCanRequest(kind, priority);
    } catch (err: any) {
      logger.warn('[WiGLE Gateway] Stats request blocked by quota policy', {
        entrypoint,
        message: err?.message,
        status: err?.status,
      });
      logWigleAuditEvent({
        entrypoint,
        endpointType: endpointType ?? kind,
        paramsHash,
        status: err?.status === 429 ? 'SOFT_LIMIT' : 'QUOTA_BLOCK',
        latencyMs: 0,
        servedFromCache: false,
        retryCount: 0,
        kind,
      });
      return {
        ok: false,
        error: err?.message ?? 'WiGLE stats request blocked',
        status: err?.status,
      };
    }
  }

  const startedAt = Date.now();

  try {
    const { response, ledgerId } = await fetchWigle({
      kind,
      url,
      init,
      timeoutMs: req.timeoutMs,
      maxRetries: req.maxRetries,
      label: req.label,
      priority: req.priority,
      entrypoint,
      paramsHash,
      endpointType,
      query_source: req.query_source,
    });

    const latencyMs = Date.now() - startedAt;

    logWigleAuditEvent({
      entrypoint,
      endpointType: endpointType ?? kind,
      paramsHash,
      status: response.ok ? 'OK' : String(response.status),
      latencyMs,
      servedFromCache: false,
      retryCount: 0,
      kind,
    });

    updateLedgerOutcome(kind, ledgerId, {
      status: response.ok ? 'success' : 'error',
      duration_ms: latencyMs,
      http_status: response.status,
      error_message: response.ok
        ? undefined
        : `HTTP ${response.status}: ${response.statusText || 'error'}`,
      retry_after_hint:
        response.status === 429 ? parseRetryAfter(response.headers.get('Retry-After')) : null,
    });

    return { ok: true, response, latencyMs, ledgerId };
  } catch (err: any) {
    const latencyMs = Date.now() - startedAt;
    const status: number | undefined = err?.status;

    logWigleAuditEvent({
      entrypoint,
      endpointType: endpointType ?? kind,
      paramsHash,
      status: status ? String(status) : 'ERROR',
      latencyMs,
      servedFromCache: false,
      retryCount: 0,
      kind,
    });

    const ledgerStatus = status === 429 ? 'rate_limited' : 'error';
    const isTimeout = err?.name === 'AbortError' || err?.message?.includes('aborted');
    const errorMessage = isTimeout
      ? `timeout after ${latencyMs}ms`
      : status
        ? `HTTP ${status}: ${err?.message ?? String(err)}`
        : (err?.message ?? String(err));

    updateLedgerOutcome(kind, null, {
      status: ledgerStatus,
      duration_ms: latencyMs,
      http_status: status,
      error_message: errorMessage,
    });

    return { ok: false, error: err?.message ?? String(err), status };
  }
}
