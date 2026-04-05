/**
 * Filtered Networks API Types and Helpers
 */

import type { Request, Response } from 'express';
const { v2Service } = require('../../../config/container');

// Type definitions

export interface Filters {
  [key: string]: unknown;
}

export interface EnabledFlags {
  distanceFromHomeMin?: boolean;
  distanceFromHomeMax?: boolean;
  [key: string]: boolean | undefined;
}

export interface ValidationResult {
  errors: string[];
}

interface ParseValidatedFiltersSuccess {
  ok: true;
  filters: Filters;
  enabled: EnabledFlags;
}

interface ParseValidatedFiltersError {
  ok: false;
  status: number;
  body: { ok: false; error?: string; errors?: string[] };
}

export type ParseValidatedFiltersResult = ParseValidatedFiltersSuccess | ParseValidatedFiltersError;

export const isParseValidatedFiltersError = (
  result: ParseValidatedFiltersResult
): result is ParseValidatedFiltersError => result.ok === false;

export interface QueryResult<T = unknown> {
  rows: T[];
  rowCount: number | null;
}

export interface FilterQueryResult {
  sql: string;
  params: unknown[];
  appliedFilters: string[];
  ignoredFilters: string[];
  warnings: string[];
}

export interface ThreatObject {
  score?: number;
  level?: string;
  flags?: string[];
  signals?: ThreatSignal[];
}

export interface ThreatSignal {
  code?: string;
  rule?: string;
  evidence?: Record<string, unknown> | unknown;
}

export interface ThreatEvidence {
  rule: string;
  observedValue: unknown;
  threshold: unknown;
}

export interface ThreatTransparency {
  threatReasons: string[];
  threatEvidence: ThreatEvidence[];
  transparencyError: boolean;
}

export interface NetworkRow {
  bssid: string;
  ssid: string | null;
  lat: number;
  lon: number;
  centroid_lat: number | null;
  centroid_lon: number | null;
  weighted_lat: number | null;
  weighted_lon: number | null;
  threat?: ThreatObject;
  [key: string]: unknown;
}

export interface GeospatialRow {
  bssid: string;
  ssid: string | null;
  lat: number;
  lon: number;
  centroid_lat: number | null;
  centroid_lon: number | null;
  weighted_lat: number | null;
  weighted_lon: number | null;
  level: number | null;
  accuracy: number | null;
  altitude: number | null;
  time: Date | null;
  obs_number: number | null;
  radio_frequency: number | null;
  radio_capabilities: string | null;
  radio_type: string | null;
  threat?: ThreatObject;
}

export const DEBUG_GEOSPATIAL = process.env.DEBUG_GEOSPATIAL === 'true';

export const parseJsonParam = <T>(value: string | undefined, fallback: T, name: string): T => {
  if (!value) {
    return fallback;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    throw new Error(`Invalid JSON for ${name}`);
  }
};

export const parseAndValidateFilters = (
  req: Request,
  validateFilterPayload: (filters: Filters, enabled: EnabledFlags) => ValidationResult
): ParseValidatedFiltersResult => {
  let filters: Filters;
  let enabled: EnabledFlags;
  try {
    filters = parseJsonParam(req.query.filters as string | undefined, {}, 'filters');
    enabled = parseJsonParam(req.query.enabled as string | undefined, {}, 'enabled');
  } catch (err) {
    const error = err as Error;
    return {
      ok: false,
      status: 400,
      body: { ok: false, error: error.message },
    };
  }

  const { errors } = validateFilterPayload(filters, enabled);
  if (errors.length > 0) {
    return {
      ok: false,
      status: 400,
      body: { ok: false, errors },
    };
  }

  return { ok: true, filters, enabled };
};

export const normalizeThreatTransparency = (threat: unknown): ThreatTransparency => {
  const threatObj = threat && typeof threat === 'object' ? (threat as ThreatObject) : {};
  const flags = Array.isArray(threatObj.flags) ? threatObj.flags : [];
  const signals = Array.isArray(threatObj.signals) ? threatObj.signals : [];

  let reasons = flags.length > 0 ? flags : (signals.map((s) => s.code).filter(Boolean) as string[]);

  const evidence: ThreatEvidence[] = signals.map((signal) => {
    const rule = signal.code || signal.rule || 'UNKNOWN';
    const signalEvidence = signal.evidence;
    const observedValue =
      signalEvidence && typeof signalEvidence === 'object'
        ? Object.keys(signalEvidence as Record<string, unknown>).length === 1
          ? (signalEvidence as Record<string, unknown>)[
              Object.keys(signalEvidence as Record<string, unknown>)[0]
            ]
          : JSON.stringify(signalEvidence)
        : (signalEvidence ?? null);

    let threshold: unknown = null;
    if (rule === 'EXCESSIVE_MOVEMENT') threshold = 0.2;
    if (rule === 'SPEED_PATTERN') threshold = 20;
    if (rule === 'TEMPORAL_PATTERN') threshold = 2;
    if (rule === 'HIGH_OBSERVATION_COUNT') threshold = 20;
    if (rule === 'HOME_AND_AWAY') threshold = 'home & away';

    return { rule, observedValue, threshold };
  });

  const score = Number(threatObj.score || 0);
  const level = String(threatObj.level || 'NONE').toUpperCase();
  const flagged = score > 0 || level !== 'NONE';

  if (flagged && reasons.length === 0) {
    reasons = ['MISSING_THREAT_REASONS'];
  }

  return {
    threatReasons: reasons,
    threatEvidence: evidence,
    transparencyError: flagged && reasons.length === 0,
  };
};

export const buildOrderBy = (sort: string | undefined, order: string | undefined): string => {
  const sortColumns = String(sort || 'last_seen')
    .split(',')
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
  const sortOrders = String(order || 'desc')
    .split(',')
    .map((v) => v.trim().toLowerCase());

  const threatSeverityOrderExpr = `CASE UPPER(COALESCE(ne.threat_level, 'NONE'))
    WHEN 'CRITICAL' THEN 5
    WHEN 'HIGH' THEN 4
    WHEN 'MEDIUM' THEN 3
    WHEN 'MED' THEN 3
    WHEN 'LOW' THEN 2
    WHEN 'NONE' THEN 1
    ELSE 0
  END`;

  const securityFamilyOrderExpr = `CASE
    WHEN UPPER(COALESCE(ne.security, '')) IN ('WPA3-E', 'WPA3-P', 'WPA3', 'OWE') THEN 6
    WHEN UPPER(COALESCE(ne.security, '')) IN ('WPA2-E', 'WPA2-P', 'WPA2') THEN 5
    WHEN UPPER(COALESCE(ne.security, '')) = 'WPA' THEN 4
    WHEN UPPER(COALESCE(ne.security, '')) = 'WEP' THEN 3
    WHEN UPPER(COALESCE(ne.security, '')) = 'WPS' THEN 2
    WHEN UPPER(COALESCE(ne.security, '')) = 'OPEN' THEN 1
    ELSE NULL
  END`;

  const lowerText = (column: string) => `LOWER(COALESCE(${column}, ''))`;
  const booleanPresence = (column: string) => `CASE
    WHEN ${column} IS TRUE THEN 1
    WHEN ${column} IS FALSE THEN 0
    ELSE NULL
  END`;

  const map: Record<string, string> = {
    observed_at: 'observed_at',
    last_observed_at: 'last_observed_at',
    first_observed_at: 'first_observed_at',
    last_seen: 'last_seen',
    first_seen: 'first_seen',
    ssid: lowerText('ssid'),
    bssid: lowerText('bssid'),
    signal: 'signal',
    observations: 'observations',
    threat: threatSeverityOrderExpr,
    threat_level: threatSeverityOrderExpr,
    threat_score: 'threat_score',
    threat_rule_score: 'rule_based_score',
    threat_ml_score: 'ml_threat_score',
    threat_ml_weight: 'ml_weight',
    threat_ml_boost: 'ml_boost',
    security: securityFamilyOrderExpr,
    type: lowerText('type'),
    lat: 'lat',
    lon: 'lon',
    accuracy_meters: 'accuracy_meters',
    distance_from_home_km: 'distance_from_home_km',
    stationary_confidence: 'stationary_confidence',
    frequency: 'frequency',
    channel: `CASE
      WHEN frequency BETWEEN 2412 AND 2484 THEN
        CASE WHEN frequency = 2484 THEN 14 ELSE FLOOR((frequency - 2412) / 5) + 1 END
      WHEN frequency BETWEEN 5000 AND 5900 THEN FLOOR((frequency - 5000) / 5)
      WHEN frequency BETWEEN 5925 AND 7125 THEN FLOOR((frequency - 5925) / 5)
      ELSE NULL
    END`,
    manufacturer: lowerText('manufacturer'),
    geocoded_address: lowerText('geocoded_address'),
    geocoded_city: lowerText('geocoded_city'),
    geocoded_state: lowerText('geocoded_state'),
    geocoded_postal_code: lowerText('geocoded_postal_code'),
    geocoded_country: lowerText('geocoded_country'),
    geocoded_poi_name: lowerText('geocoded_poi_name'),
    geocoded_poi_category: lowerText('geocoded_poi_category'),
    geocoded_feature_type: lowerText('geocoded_feature_type'),
    geocoded_provider: lowerText('geocoded_provider'),
    geocoded_confidence: 'geocoded_confidence',
    threat_tag: lowerText('threat_tag'),
    is_ignored: booleanPresence('is_ignored'),
    all_tags: lowerText('all_tags'),
    notes_count: 'notes_count',
    min_altitude_m: 'min_altitude_m',
    max_altitude_m: 'max_altitude_m',
    altitude_span_m: 'altitude_span_m',
    last_altitude_m: 'last_altitude_m',
    is_sentinel: booleanPresence('is_sentinel'),
    timespan_days: 'EXTRACT(EPOCH FROM (last_seen - first_seen)) / 86400',
    wigle_v3_observation_count: 'wigle_v3_observation_count',
    wigle_v3_last_import_at: 'wigle_v3_last_import_at',
    max_distance_meters: 'max_distance_meters',
    centroid_lat: 'centroid_lat',
    centroid_lon: 'centroid_lon',
    weighted_lat: 'weighted_lat',
    weighted_lon: 'weighted_lon',
  };

  const clauses = sortColumns.map((col, idx) => {
    const mapped = map[col] || map.last_seen;
    const dir = sortOrders[idx] === 'asc' ? 'ASC' : 'DESC';
    return `${mapped} ${dir} NULLS LAST`;
  });

  const resolvedClauses = clauses.length > 0 ? clauses : [`${map.last_seen} DESC NULLS LAST`];
  const hasBssidTiebreaker = resolvedClauses.some((clause) => clause.includes('ne.bssid'));

  if (!hasBssidTiebreaker) {
    resolvedClauses.push('ne.bssid ASC');
  }

  return resolvedClauses.join(', ');
};

export const assertHomeExistsIfNeeded = async (
  enabled: EnabledFlags,
  res: Response
): Promise<boolean> => {
  if (!enabled.distanceFromHomeMin && !enabled.distanceFromHomeMax) {
    return true;
  }
  try {
    const exists = await v2Service.checkHomeExists();
    if (!exists) {
      res.status(400).json({
        ok: false,
        error: 'Home location is required for distance filters.',
      });
      return false;
    }
    return true;
  } catch (err) {
    const error = err as { code?: string };
    if (error && error.code === '42P01') {
      res.status(400).json({
        ok: false,
        error: 'Home location markers table is missing (app.location_markers).',
      });
      return false;
    }
    throw err;
  }
};
