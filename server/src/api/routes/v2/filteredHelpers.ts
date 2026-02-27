/**
 * Filtered Networks API Types and Helpers
 */

import type { Response } from 'express';
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
  threat?: ThreatObject;
  [key: string]: unknown;
}

export interface GeospatialRow {
  bssid: string;
  ssid: string | null;
  lat: number;
  lon: number;
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

  const map: Record<string, string> = {
    observed_at: 'l.observed_at',
    last_observed_at: 'r.last_observed_at',
    first_observed_at: 'r.first_observed_at',
    last_seen: 'ne.last_seen',
    first_seen: 'ne.first_seen',
    ssid: 'ne.ssid',
    bssid: 'ne.bssid',
    signal: 'l.level',
    observations: 'r.observation_count',
    threat: 'ne.threat_level',
    threat_score: 'ne.threat_score',
    threat_rule_score: 'ne.rule_score',
    threat_ml_score: 'ne.ml_score',
    threat_ml_weight: 'ne.ml_weight',
    threat_ml_boost: 'ne.ml_boost',
    security: 'security',
    type: 'ne.type',
    lat: 'lat',
    lon: 'lon',
    accuracy_meters: 'accuracy_meters',
    distance_from_home_km: 'ne.distance_from_home_km',
    stationary_confidence: 's.stationary_confidence',
    frequency: 'ne.frequency',
    channel: `CASE
      WHEN ne.frequency BETWEEN 2412 AND 2484 THEN
        CASE WHEN ne.frequency = 2484 THEN 14 ELSE FLOOR((ne.frequency - 2412) / 5) + 1 END
      WHEN ne.frequency BETWEEN 5000 AND 5900 THEN FLOOR((ne.frequency - 5000) / 5)
      WHEN ne.frequency BETWEEN 5925 AND 7125 THEN FLOOR((ne.frequency - 5925) / 5)
      ELSE NULL
    END`,
    manufacturer:
      "COALESCE(to_jsonb(rm)->>'organization_name', to_jsonb(rm)->>'manufacturer', to_jsonb(rm)->>'manufacturer_name')",
    threat_tag: "COALESCE(to_jsonb(nt)->>'threat_tag', to_jsonb(nt)->>'tag_type')",
    is_ignored: "COALESCE((to_jsonb(nt)->>'is_ignored')::boolean, FALSE)",
    all_tags:
      "COALESCE(to_jsonb(nt)->>'all_tags', to_jsonb(nt)->>'threat_tag', to_jsonb(nt)->>'tag_type')",
    notes_count: 'notes_count',
    min_altitude_m: 'min_altitude_m',
    max_altitude_m: 'max_altitude_m',
    altitude_span_m: 'altitude_span_m',
    last_altitude_m: 'last_altitude_m',
    is_sentinel: 'is_sentinel',
    timespan_days: 'EXTRACT(EPOCH FROM (r.last_observed_at - r.first_observed_at)) / 86400',
    wigle_v3_observation_count: 'ne.wigle_v3_observation_count',
    wigle_v3_last_import_at: 'ne.wigle_v3_last_import_at',
    max_distance_meters: 'ne.max_distance_meters',
  };

  const clauses = sortColumns.map((col, idx) => {
    const mapped = map[col] || map.last_seen;
    const dir = sortOrders[idx] === 'asc' ? 'ASC' : 'DESC';
    return `${mapped} ${dir} NULLS LAST`;
  });

  return clauses.length > 0 ? clauses.join(', ') : `${map.last_seen} DESC`;
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
