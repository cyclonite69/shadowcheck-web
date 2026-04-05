const DEFAULT_LIMIT = 1000;
const DEFAULT_PRECISION = 5;
const DEFAULT_PER_MINUTE_SLOW = 60;
const DEFAULT_PER_MINUTE_FAST = 200;
const SUPPORTED_MODES = ['address-only', 'poi-only', 'both'];
const SUPPORTED_PROVIDERS = [
  'mapbox',
  'locationiq',
  'opencage',
  'geocodio',
  'nominatim',
  'overpass',
];
const BACKOFF_DEFAULTS = {
  loopDelayMs: 15000,
  idleSleepMs: 180000,
  errorSleepMs: 60000,
};
const API_KEY_PROVIDERS = ['nominatim', 'overpass', 'opencage', 'geocodio', 'locationiq'];

const hasMissingKeyError = (error: any) =>
  typeof error?.message === 'string' && error.message.startsWith('missing_key:');

const missingKeyInfo = (error: any) => {
  const provider = error.message.split(':')[1] || 'provider';
  return { ok: false, error: `Missing API key for ${provider}` };
};

const normalizeNumber = (value: unknown, fallback: number) => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeBoolean = (value: unknown, fallback = false) => {
  if (typeof value === 'boolean') return value;
  if (value === undefined || value === null) return fallback;
  return String(value).toLowerCase() === 'true';
};

const normalizeProvider = (value: unknown) =>
  String(value ?? 'mapbox')
    .trim()
    .toLowerCase();

const validateProvider = (provider: string) => {
  if (!SUPPORTED_PROVIDERS.includes(provider)) {
    throw new Error(`Unsupported geocoding provider '${provider}'`);
  }
  return provider;
};

const normalizeMode = (value: unknown, fallback: string) => {
  const mode = String(value ?? fallback)
    .trim()
    .toLowerCase();
  if (!SUPPORTED_MODES.includes(mode)) {
    throw new Error(`Unsupported geocoding mode '${mode}'`);
  }
  return mode;
};

const getPerMinute = (provider: string, override: unknown) => {
  if (override !== undefined && override !== null && override !== '') {
    return normalizeNumber(
      override,
      provider === 'mapbox' ? DEFAULT_PER_MINUTE_FAST : DEFAULT_PER_MINUTE_SLOW
    );
  }
  return API_KEY_PROVIDERS.includes(provider) ? DEFAULT_PER_MINUTE_SLOW : DEFAULT_PER_MINUTE_FAST;
};

const normalizeDaemonProviderEntry = (entry: Record<string, unknown>) => {
  const provider = validateProvider(normalizeProvider(entry.provider));
  const mode = normalizeMode(entry.mode, 'address-only');
  const limit =
    entry.limit !== undefined && entry.limit !== null && entry.limit !== ''
      ? normalizeNumber(entry.limit, DEFAULT_LIMIT)
      : undefined;
  const perMinute =
    entry.perMinute !== undefined && entry.perMinute !== null && entry.perMinute !== ''
      ? normalizeNumber(entry.perMinute, getPerMinute(provider, undefined))
      : undefined;
  const permanent =
    entry.permanent !== undefined && entry.permanent !== null
      ? normalizeBoolean(entry.permanent)
      : undefined;

  return {
    provider,
    mode,
    limit,
    perMinute,
    enabled: normalizeBoolean(entry.enabled, true),
    permanent,
  };
};

const parseRunOptions = (payload: Record<string, unknown> = {}) => {
  const provider = validateProvider(normalizeProvider(payload.provider));
  return {
    provider,
    mode: normalizeMode(payload.mode, 'address-only'),
    limit: normalizeNumber(payload.limit, DEFAULT_LIMIT),
    precision: normalizeNumber(payload.precision, DEFAULT_PRECISION),
    perMinute: getPerMinute(provider, payload.perMinute),
    permanent: normalizeBoolean(payload.permanent, true),
  };
};

const parseDaemonOptions = (payload: Record<string, unknown> = {}) => {
  const base = parseRunOptions(payload);
  return {
    ...base,
    limit: normalizeNumber(payload.limit, 250),
    loopDelayMs: normalizeNumber(payload.loopDelayMs, BACKOFF_DEFAULTS.loopDelayMs),
    idleSleepMs: normalizeNumber(payload.idleSleepMs, BACKOFF_DEFAULTS.idleSleepMs),
    errorSleepMs: normalizeNumber(payload.errorSleepMs, BACKOFF_DEFAULTS.errorSleepMs),
    providers: Array.isArray(payload.providers)
      ? payload.providers.map((entry) =>
          normalizeDaemonProviderEntry(entry as Record<string, unknown>)
        )
      : [],
  };
};

const parseTestOptions = (payload: Record<string, unknown> = {}) => {
  const provider = validateProvider(normalizeProvider(payload.provider || 'locationiq'));
  const mode = normalizeMode(payload.mode, provider === 'overpass' ? 'poi-only' : 'address-only');
  return {
    provider,
    mode,
    precision: normalizeNumber(payload.precision, 4),
    permanent: normalizeBoolean(payload.permanent, false),
    lat: payload.lat !== undefined ? Number(payload.lat) : undefined,
    lon: payload.lon !== undefined ? Number(payload.lon) : undefined,
  };
};

module.exports = {
  API_KEY_PROVIDERS,
  parseRunOptions,
  parseDaemonOptions,
  parseTestOptions,
  missingKeyInfo,
  hasMissingKeyError,
};
