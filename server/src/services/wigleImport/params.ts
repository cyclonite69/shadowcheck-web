const crypto = require('crypto');

export type WigleImportParams = {
  ssid?: string;
  bssid?: string;
  latrange1?: string;
  latrange2?: string;
  longrange1?: string;
  longrange2?: string;
  country?: string;
  region?: string;
  city?: string;
  resultsPerPage?: number;
  version?: 'v2';
};

export const DEFAULT_RESULTS_PER_PAGE = 100;
const MAX_RESULTS_PER_PAGE = 1000;

const allowedParams = [
  'ssid',
  'bssid',
  'latrange1',
  'latrange2',
  'longrange1',
  'longrange2',
  'country',
  'region',
  'city',
  'resultsPerPage',
  'version',
] as const;

const stableStringify = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return `{${entries
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
};

export const normalizeImportParams = (raw: Record<string, unknown>): WigleImportParams => {
  const normalized: WigleImportParams = {};
  for (const key of allowedParams) {
    const value = raw[key];
    if (value === undefined || value === null || value === '') continue;
    if (key === 'resultsPerPage') {
      normalized.resultsPerPage = Math.min(
        Math.max(parseInt(String(value), 10) || DEFAULT_RESULTS_PER_PAGE, 1),
        MAX_RESULTS_PER_PAGE
      );
      continue;
    }
    if (key === 'version') {
      normalized.version = 'v2';
      continue;
    }
    normalized[key] = String(value);
  }
  if (!normalized.country) normalized.country = 'US';
  if (!normalized.resultsPerPage) normalized.resultsPerPage = DEFAULT_RESULTS_PER_PAGE;
  if (!normalized.version) normalized.version = 'v2';
  return normalized;
};

export const validateImportQuery = (queryInput: Record<string, unknown>): string | null => {
  const query = normalizeImportParams(queryInput);
  if (query.version && query.version !== 'v2') {
    return 'Resumable WiGLE imports currently support only the v2 search API.';
  }
  if (
    !query.ssid &&
    !query.bssid &&
    !query.latrange1 &&
    !query.country &&
    !query.region &&
    !query.city
  ) {
    return 'At least one search parameter required (ssid, bssid, latrange, country, region, or city)';
  }
  return null;
};

export const buildSearchParams = (
  query: WigleImportParams,
  searchAfter?: string | null,
  apiVer: 'v2' | 'v3' = 'v2'
): URLSearchParams => {
  const params = new URLSearchParams();
  if (query.ssid) params.append('ssidlike', query.ssid);
  if (query.bssid) params.append('netid', query.bssid);
  if (query.latrange1) params.append('latrange1', query.latrange1);
  if (query.latrange2) params.append('latrange2', query.latrange2);
  if (query.longrange1) params.append('longrange1', query.longrange1);
  if (query.longrange2) params.append('longrange2', query.longrange2);
  if (query.country) params.append('country', query.country);
  if (query.region) params.append('region', query.region);
  if (query.city) params.append('city', query.city);
  params.append('resultsPerPage', String(query.resultsPerPage || DEFAULT_RESULTS_PER_PAGE));
  if (searchAfter) {
    if (apiVer === 'v3') {
      // v3 uses cursor-based pagination
      params.append('search_after', searchAfter);
    } else {
      // v2 uses searchAfter for cursors (e.g. from WiGLE search)
      params.append('searchAfter', searchAfter);

      // If it's purely numeric, some legacy v2 endpoints might have used 'first'
      if (/^\d+$/.test(searchAfter)) {
        params.append('first', searchAfter);
      }
    }
  }
  return params;
};

export const getSearchTerm = (query: WigleImportParams): string =>
  query.ssid || query.bssid || query.city || '';

export const getRequestFingerprint = (query: WigleImportParams): string =>
  crypto.createHash('sha256').update(stableStringify(query)).digest('hex');
