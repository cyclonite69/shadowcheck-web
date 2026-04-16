import { query } from '../config/database';
import logger from '../logging/logger';

type DbBackedFlagKey =
  | 'admin_allow_docker'
  | 'admin_allow_ml_training'
  | 'admin_allow_ml_scoring'
  | 'enable_background_jobs'
  | 'simple_rule_scoring_enabled'
  | 'allow_mobile_ingest_auto_process'
  | 'score_debug_logging'
  | 'auto_geocode_on_import'
  | 'dedupe_on_scan';

const FLAG_DEFAULTS: Record<DbBackedFlagKey, boolean> = {
  admin_allow_docker: String(process.env.ADMIN_ALLOW_DOCKER || '').toLowerCase() === 'true',
  admin_allow_ml_training:
    String(process.env.ADMIN_ALLOW_ML_TRAINING ?? 'true').toLowerCase() === 'true',
  admin_allow_ml_scoring:
    String(process.env.ADMIN_ALLOW_ML_SCORING ?? 'true').toLowerCase() === 'true',
  enable_background_jobs: process.env.ENABLE_BACKGROUND_JOBS === 'true',
  simple_rule_scoring_enabled: process.env.SIMPLE_RULE_SCORING_ENABLED === 'true',
  allow_mobile_ingest_auto_process: process.env.ALLOW_MOBILE_INGEST_AUTO_PROCESS === 'true',
  score_debug_logging: false,
  auto_geocode_on_import: true,
  dedupe_on_scan: true,
};

const DB_BACKED_FLAG_KEYS = Object.keys(FLAG_DEFAULTS) as DbBackedFlagKey[];

const flagCache: Record<DbBackedFlagKey, boolean> = { ...FLAG_DEFAULTS };
let cacheLoaded = false;

const coerceBoolean = (value: unknown, defaultValue: boolean): boolean => {
  if (typeof value === 'boolean') return value;
  if (value === null || value === undefined || value === '') return defaultValue;
  if (typeof value === 'string') return value.trim().toLowerCase() === 'true';
  return defaultValue;
};

async function refreshCache(): Promise<Record<DbBackedFlagKey, boolean>> {
  try {
    const { rows } = await query(
      'SELECT key, value FROM app.settings WHERE key = ANY($1::text[])',
      [DB_BACKED_FLAG_KEYS]
    );

    const nextCache: Record<DbBackedFlagKey, boolean> = { ...FLAG_DEFAULTS };
    rows.forEach((row: { key: DbBackedFlagKey; value: unknown }) => {
      nextCache[row.key] = coerceBoolean(row.value, FLAG_DEFAULTS[row.key]);
    });

    DB_BACKED_FLAG_KEYS.forEach((key) => {
      flagCache[key] = nextCache[key];
    });
    cacheLoaded = true;
  } catch (error) {
    logger.warn('[Feature Flags] Failed to refresh DB-backed feature flags, using cache/defaults', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return { ...flagCache };
}

function getFlag(key: DbBackedFlagKey): boolean {
  return cacheLoaded ? flagCache[key] : FLAG_DEFAULTS[key];
}

function getAllFlags(): Record<DbBackedFlagKey, boolean> {
  return cacheLoaded ? { ...flagCache } : { ...FLAG_DEFAULTS };
}

function isDbBackedFlagKey(value: string): value is DbBackedFlagKey {
  return (DB_BACKED_FLAG_KEYS as string[]).includes(value);
}

module.exports = {
  refreshCache,
  getFlag,
  getAllFlags,
  isDbBackedFlagKey,
  DB_BACKED_FLAG_KEYS,
};

export {};
