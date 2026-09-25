const crypto = require('crypto');

export type WigleBtImportParams = {
  namelike?: string;
  netid?: string;
  latrange1?: string;
  latrange2?: string;
  longrange1?: string;
  longrange2?: string;
  country?: string;
  region?: string;
  city?: string;
  mfgrIdMinimum?: number;
  mfgrIdMaximum?: number;
  showBt?: boolean;
  showBle?: boolean;
  resultsPerPage?: number;
};

export const DEFAULT_BT_RESULTS_PER_PAGE = 100;
const MAX_BT_RESULTS_PER_PAGE = 1000;

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

export const normalizeBtImportParams = (raw: Record<string, unknown>): WigleBtImportParams => {
  const normalized: WigleBtImportParams = {};

  const stringKeys = [
    'namelike',
    'netid',
    'latrange1',
    'latrange2',
    'longrange1',
    'longrange2',
    'country',
    'region',
    'city',
  ] as const;
  for (const key of stringKeys) {
    const value = raw[key];
    if (value !== undefined && value !== null && value !== '') {
      normalized[key] = String(value);
    }
  }

  for (const key of ['mfgrIdMinimum', 'mfgrIdMaximum'] as const) {
    const value = raw[key];
    if (value !== undefined && value !== null && value !== '') {
      const num = Number(value);
      if (Number.isFinite(num) && num >= 0) {
        normalized[key] = Math.floor(num);
      }
    }
  }

  for (const key of ['showBt', 'showBle'] as const) {
    const value = raw[key];
    if (value !== undefined && value !== null && value !== '') {
      normalized[key] = value === true || value === 'true';
    }
  }

  const rpp = raw.resultsPerPage;
  if (rpp !== undefined && rpp !== null && rpp !== '') {
    normalized.resultsPerPage = Math.min(
      Math.max(parseInt(String(rpp), 10) || DEFAULT_BT_RESULTS_PER_PAGE, 1),
      MAX_BT_RESULTS_PER_PAGE
    );
  }

  if (!normalized.country) {
    normalized.country = 'US';
  }
  if (!normalized.resultsPerPage) {
    normalized.resultsPerPage = DEFAULT_BT_RESULTS_PER_PAGE;
  }
  if (normalized.showBt === undefined) {
    normalized.showBt = true;
  }
  if (normalized.showBle === undefined) {
    normalized.showBle = true;
  }

  return normalized;
};

export const validateBtImportQuery = (queryInput: Record<string, unknown>): string | null => {
  const query = normalizeBtImportParams(queryInput);
  if (
    !query.namelike &&
    !query.netid &&
    !query.latrange1 &&
    !query.country &&
    !query.region &&
    !query.city &&
    query.mfgrIdMinimum === undefined &&
    query.mfgrIdMaximum === undefined
  ) {
    return 'At least one search parameter required (namelike, netid, latrange, country, region, city, or mfgrId range)';
  }
  return null;
};

export const buildBtSearchParams = (
  query: WigleBtImportParams,
  searchAfter?: string | null
): URLSearchParams => {
  const params = new URLSearchParams();
  if (query.namelike) {
    params.append('namelike', query.namelike);
  }
  if (query.netid) {
    params.append('netid', query.netid);
  }
  if (query.latrange1) {
    params.append('latrange1', query.latrange1);
  }
  if (query.latrange2) {
    params.append('latrange2', query.latrange2);
  }
  if (query.longrange1) {
    params.append('longrange1', query.longrange1);
  }
  if (query.longrange2) {
    params.append('longrange2', query.longrange2);
  }
  if (query.country) {
    params.append('country', query.country);
  }
  if (query.region) {
    params.append('region', query.region);
  }
  if (query.city) {
    params.append('city', query.city);
  }
  if (query.mfgrIdMinimum !== undefined) {
    params.append('mfgrIdMinimum', String(query.mfgrIdMinimum));
  }
  if (query.mfgrIdMaximum !== undefined) {
    params.append('mfgrIdMaximum', String(query.mfgrIdMaximum));
  }
  if (query.showBt === false) {
    params.append('showBt', 'false');
  }
  if (query.showBle === false) {
    params.append('showBle', 'false');
  }
  params.append('resultsPerPage', String(query.resultsPerPage || DEFAULT_BT_RESULTS_PER_PAGE));
  if (searchAfter) {
    params.append('searchAfter', searchAfter);
  }
  return params;
};

export const getBtSearchTerm = (query: WigleBtImportParams): string => {
  if (query.namelike) {
    return query.namelike;
  }
  if (query.netid) {
    return query.netid;
  }
  if (query.mfgrIdMinimum !== undefined) {
    return `mfgr:${query.mfgrIdMinimum}`;
  }
  if (query.city) {
    return query.city;
  }
  return query.country || '';
};

export const getBtRequestFingerprint = (query: WigleBtImportParams): string =>
  crypto.createHash('sha256').update(stableStringify(query)).digest('hex');
