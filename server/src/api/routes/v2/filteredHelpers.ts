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
  has_siblings?: boolean;
  sibling_count?: number;
  sibling_max_confidence?: number | null;
  has_strong_sibling?: boolean;
  sibling_bssids?: string[];
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
  has_siblings: boolean;
  sibling_count: number;
  sibling_max_confidence: number | null;
  has_strong_sibling: boolean;
  sibling_bssids: string[];
  level: number | null;
  accuracy: number | null;
  altitude: number | null;
  time: Date | null;
  obs_number: number | null;
  radio_frequency: number | null;
  radio_capabilities: string | null;
  radio_type: string | null;
  threat?: ThreatObject;
  media_count?: number;
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
    if (rule === 'EXCESSIVE_MOVEMENT') {
      threshold = 0.2;
    }
    if (rule === 'SPEED_PATTERN') {
      threshold = 20;
    }
    if (rule === 'TEMPORAL_PATTERN') {
      threshold = 2;
    }
    if (rule === 'HIGH_OBSERVATION_COUNT') {
      threshold = 20;
    }
    if (rule === 'HOME_AND_AWAY') {
      threshold = 'home & away';
    }

    return { rule, observedValue, threshold };
  });

  const score = Number(threatObj.score || 0);
  const level = String(threatObj.level || 'NONE').toUpperCase();
  const flagged = score > 0 || level !== 'NONE';
  const transparencyError = flagged && reasons.length === 0;

  if (transparencyError) {
    reasons = ['MISSING_THREAT_REASONS'];
  }

  return {
    threatReasons: reasons,
    threatEvidence: evidence,
    transparencyError,
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
    observed_at: 'ne.observed_at',
    last_observed_at: 'ne.last_seen',
    first_observed_at: 'ne.first_seen',
    last_seen: 'ne.last_seen',
    first_seen: 'ne.first_seen',
    ssid: lowerText('ne.ssid'),
    bssid: lowerText('ne.bssid'),
    signal: 'ne.signal',
    observations: 'ne.observations',
    threat: threatSeverityOrderExpr,
    threat_level: threatSeverityOrderExpr,
    threat_score: 'ne.threat_score',
    threat_rule_score: 'ne.rule_based_score',
    threat_ml_score: 'ne.ml_threat_score',
    threat_ml_weight: 'ne.ml_weight',
    threat_ml_boost: 'ne.ml_boost',
    security: securityFamilyOrderExpr,
    type: lowerText('ne.type'),
    lat: 'ne.lat',
    lon: 'ne.lon',
    raw_lat: 'n.bestlat',
    raw_lon: 'n.bestlon',
    accuracy_meters: 'ne.accuracy_meters',
    distance_from_home_km: 'ne.distance_from_home_km',
    stationary_confidence: 'ne.stationary_confidence',
    frequency: 'ne.frequency',
    channel: `CASE
      WHEN ne.frequency BETWEEN 2412 AND 2484 THEN
        CASE WHEN ne.frequency = 2484 THEN 14 ELSE FLOOR((ne.frequency - 2412) / 5) + 1 END
      WHEN ne.frequency BETWEEN 5000 AND 5900 THEN FLOOR((ne.frequency - 5000) / 5)
      WHEN ne.frequency BETWEEN 5925 AND 7125 THEN FLOOR((ne.frequency - 5925) / 5)
      ELSE NULL
    END`,
    manufacturer: lowerText('ne.manufacturer'),
    geocoded_address: lowerText('ne.geocoded_address'),
    geocoded_city: lowerText('ne.geocoded_city'),
    geocoded_state: lowerText('ne.geocoded_state'),
    geocoded_postal_code: lowerText('ne.geocoded_postal_code'),
    geocoded_country: lowerText('ne.geocoded_country'),
    geocoded_poi_name: lowerText('ne.geocoded_poi_name'),
    geocoded_poi_category: lowerText('ne.geocoded_poi_category'),
    geocoded_feature_type: lowerText('ne.geocoded_feature_type'),
    geocoded_provider: lowerText('ne.geocoded_provider'),
    geocoded_confidence: 'ne.geocoded_confidence',
    threat_tag: lowerText('nt.threat_tag'),
    is_ignored: booleanPresence('nt.is_ignored'),
    all_tags: lowerText('nt.all_tags'),
    notes_count: 'COALESCE(nn_agg.notes_count, 0)',
    min_altitude_m: 'n.min_altitude_m',
    max_altitude_m: 'n.max_altitude_m',
    altitude_span_m: 'n.altitude_span_m',
    last_altitude_m: 'n.last_altitude_m',
    is_sentinel: booleanPresence('n.is_sentinel'),
    timespan_days: 'EXTRACT(EPOCH FROM (ne.last_seen - ne.first_seen)) / 86400',
    wigle_v3_observation_count: 'ne.wigle_v3_observation_count',
    wigle_v3_last_import_at: 'ne.wigle_v3_last_import_at',
    unique_days: 'ne.unique_days',
    unique_locations: 'ne.unique_locations',
    max_distance_meters: 'ne.max_distance_meters',
    centroid_lat: 'ne.centroid_lat',
    centroid_lon: 'ne.centroid_lon',
    weighted_lat: 'ne.weighted_lat',
    weighted_lon: 'ne.weighted_lon',
    has_siblings: booleanPresence('ne.has_siblings'),
    sibling_count: 'ne.sibling_count',
    sibling_max_confidence: 'ne.sibling_max_confidence',
    has_strong_sibling: booleanPresence('ne.has_strong_sibling'),
    sibling_bssids: lowerText('ne.sibling_bssids::text'),
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
