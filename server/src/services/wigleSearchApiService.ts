import logger from '../logging/logger';
import { logWigleAuditEvent } from './wigleAuditLogger';
import { wigleGatewayFetch } from './wigle/wigleGateway';
import { hashRecord, normalizeParams } from './wigleRequestUtils';
import { getCachedSearchResponse, setCachedSearchResponse } from './wigleSearchCache';
import { updateLedgerOutcome } from './wigleRequestLedger';

export {};

type SearchEntryPoint = 'manual-search' | 'import-run';

export const DEFAULT_IMPORT_SEARCH_TIMEOUT_MS = 60_000;

export function getImportSearchTimeoutMs(): number {
  const envVal = process.env.WIGLE_IMPORT_SEARCH_TIMEOUT_MS;
  if (envVal !== undefined && envVal !== '') {
    const parsed = Number(envVal);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return DEFAULT_IMPORT_SEARCH_TIMEOUT_MS;
}

// Log effective timeout once at startup so deployment configuration is auditable
logger.info(`[WiGLE Search] Effective import-run search timeout: ${getImportSearchTimeoutMs()}ms`);

async function fetchWigleSearchPage(options: {
  encodedAuth: string;
  apiVer: 'v2';
  params: URLSearchParams;
  entrypoint: SearchEntryPoint;
  query_source?: string;
}) {
  const { encodedAuth, apiVer, params, entrypoint, query_source } = options;
  const paramsHash = hashRecord({ apiVer, params: normalizeParams(params) });
  const cached = getCachedSearchResponse(paramsHash);

  if (cached) {
    logger.info('[WiGLE] Serving search response from in-memory cache', {
      apiVer,
      entrypoint,
      paramsHash,
    });
    logWigleAuditEvent({
      entrypoint,
      endpointType: `${apiVer}/network/search`,
      paramsHash,
      status: 'CACHE_HIT',
      latencyMs: 0,
      servedFromCache: true,
      retryCount: 0,
      kind: 'search',
    });
    return cached;
  }

  const apiUrl = `https://api.wigle.net/api/${apiVer}/network/search?${params.toString()}`;
  const paramsObj = Object.fromEntries(params);

  logger.info(
    `[WiGLE][${apiVer}/network/search][PRE] sending request | url=${apiUrl} | params=${JSON.stringify(paramsObj)}`
  );

  const timeoutMs = entrypoint === 'import-run' ? getImportSearchTimeoutMs() : 30000;

  const gatewayResult = await wigleGatewayFetch({
    kind: 'search',
    url: apiUrl,
    timeoutMs,
    maxRetries: entrypoint === 'import-run' ? 0 : 1,
    label: 'WiGLE Search API',
    entrypoint,
    endpointType: `${apiVer}/network/search`,
    searchParams: params,
    query_source: query_source ?? (entrypoint === 'import-run' ? 'import' : 'manual'),
    init: {
      headers: {
        Authorization: `Basic ${encodedAuth}`,
        Accept: 'application/json',
      },
    },
  });

  if (!gatewayResult.ok) {
    logger.error(
      `[WiGLE][${apiVer}/network/search][ERROR] | url=${apiUrl} | params=${JSON.stringify(paramsObj)} | error=${gatewayResult.error}`
    );
    const error: any = new Error(gatewayResult.error);
    error.status = gatewayResult.status;
    error.isTimeout = gatewayResult.isTimeout;
    error.code = gatewayResult.code;
    throw error;
  }

  const response = gatewayResult.response;
  const ledgerId = gatewayResult.ledgerId;

  if (!response.ok) {
    const errorText = await response.text();
    const retryAfterRaw = response.headers.get('Retry-After');
    logger.error(
      `[WiGLE][${apiVer}/network/search][${response.status}] request failed | url=${apiUrl} | params=${JSON.stringify(
        paramsObj
      )} | body=${errorText.substring(0, 500)}`
    );
    const error: any = new Error(`WiGLE API request failed with status ${response.status}`);
    error.status = response.status;
    error.details = errorText;
    error.retryAfter = retryAfterRaw;
    throw error;
  }

  logger.info(
    `[WiGLE][${apiVer}/network/search][${response.status}] request succeeded | url=${apiUrl} | params=${JSON.stringify(
      paramsObj
    )}`
  );

  const data = await response.json();
  const resultCount = Array.isArray((data as any)?.results) ? (data as any).results.length : null;
  if (resultCount !== null) {
    logger.info(
      `[WiGLE][${apiVer}/network/search][${response.status}] result count | url=${apiUrl} | params=${JSON.stringify(
        paramsObj
      )} | results=${resultCount}`
    );
    // Patch the ledger row with the actual result count now that the body is parsed.
    // The gateway already wrote status/duration; this only updates result_count.
    updateLedgerOutcome('search', ledgerId, {
      status: 'success',
      duration_ms: gatewayResult.latencyMs,
      http_status: response.status,
      result_count: resultCount,
    });
  }
  setCachedSearchResponse(paramsHash, data);
  return data;
}

export { fetchWigleSearchPage };
