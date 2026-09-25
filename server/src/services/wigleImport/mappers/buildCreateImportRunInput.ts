import {
  DEFAULT_RESULTS_PER_PAGE,
  getRawRequestFingerprint,
  getRequestFingerprint,
  getSearchTerm,
  normalizeImportParams,
  type WigleImportParams,
} from '../params';

type CreateImportRunOverrides = {
  source?: string;
  api_version?: string;
  search_term?: string;
};

type CreateImportRunInput = {
  apiVersion: string;
  pageSize: number;
  requestFingerprint: string;
  requestParams: Record<string, any>;
  searchTerm: string | null;
  source: string;
  state: string | null;
};

function urlSearchParamsToObject(params: URLSearchParams): Record<string, any> {
  const obj: Record<string, any> = {};
  params.forEach((value, key) => {
    if (obj[key]) {
      if (Array.isArray(obj[key])) {
        obj[key].push(value);
      } else {
        obj[key] = [obj[key], value];
      }
    } else {
      obj[key] = value;
    }
  });
  return obj;
}

function clampPageSize(value: unknown): number {
  const parsed = Number.parseInt(String(value ?? DEFAULT_RESULTS_PER_PAGE), 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_RESULTS_PER_PAGE;
  }
  return parsed;
}

function sanitizeRawRequestParams(rawQuery: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(rawQuery).filter(
      ([, value]) => value !== undefined && value !== null && value !== ''
    )
  );
}

function buildCreateImportRunInput(
  rawQuery: Record<string, unknown>,
  overrides: CreateImportRunOverrides = {}
): CreateImportRunInput {
  const normalized = normalizeImportParams(rawQuery);
  const usesDirectMetadata =
    overrides.source !== undefined ||
    overrides.api_version !== undefined ||
    overrides.search_term !== undefined;
  const requestParams = usesDirectMetadata ? sanitizeRawRequestParams(rawQuery) : normalized;
  const pageSize = usesDirectMetadata
    ? clampPageSize(rawQuery.resultsPerPage)
    : normalized.resultsPerPage || DEFAULT_RESULTS_PER_PAGE;

  return {
    source: overrides.source ?? 'wigle_v2',
    apiVersion: overrides.api_version ?? (normalized.version || 'v2'),
    searchTerm: overrides.search_term ?? getSearchTerm(normalized),
    state: normalized.region || null,
    requestFingerprint: usesDirectMetadata
      ? getRawRequestFingerprint(requestParams)
      : getRequestFingerprint(normalized),
    requestParams,
    pageSize,
  };
}

export { buildCreateImportRunInput, clampPageSize, urlSearchParamsToObject };
export type { CreateImportRunInput, CreateImportRunOverrides };
