/**
 * Universal Filter System for ShadowCheck - FINAL SCHEMA
 * Forensically correct, transparent, and consistent
 */

export interface NetworkFilters {
  // A. Identity Filters
  ssid?: string;
  bssid?: string; // Exact (full) or prefix
  manufacturer?: string; // Name or OUI prefix
  networkId?: string;

  // B. Radio / Physical Layer
  radioTypes?: RadioType[];
  frequencyBands?: FrequencyBand[];
  channelMin?: number;
  channelMax?: number;
  rssiMin?: number; // Enforced noise floor: -95 dBm
  rssiMax?: number;

  // C. Security Filters
  encryptionTypes?: EncryptionType[];
  authMethods?: AuthMethod[];
  insecureFlags?: InsecureFlag[];
  securityFlags?: SecurityFlag[]; // Inference flags from computed security

  // D. Temporal Filters (CRITICAL)
  timeframe?: TimeframeFilter;
  temporalScope?: TemporalScope;

  // E. Observation Quality (Credibility Heuristics)
  observationCountMin?: number; // DISABLED by default
  observationCountMax?: number;
  gpsAccuracyMax?: number; // meters
  excludeInvalidCoords?: boolean;

  // F. Spatial / Proximity
  distanceFromHomeMin?: number; // meters, per-observation
  distanceFromHomeMax?: number; // meters, per-observation
  boundingBox?: BoundingBox;
  radiusFilter?: RadiusFilter;

  // G. Threat & Heuristics
  threatScoreMin?: number;
  threatScoreMax?: number;
  threatCategories?: ThreatCategory[];
  stationaryConfidenceMin?: number; // 0.0 → 1.0, NOT binary
  stationaryConfidenceMax?: number;
}

export type RadioType = 'W' | 'E' | 'B' | 'L' | 'G' | 'N' | '?';
export type FrequencyBand = '2.4GHz' | '5GHz' | '6GHz' | 'BLE' | 'Cellular';
export type EncryptionType = 'OPEN' | 'WEP' | 'WPA' | 'WPA2' | 'WPA3' | 'Mixed';
export type AuthMethod = 'PSK' | 'Enterprise' | 'SAE' | 'OWE' | 'None';
export type SecurityFlag = 'insecure' | 'deprecated' | 'enterprise' | 'personal' | 'unknown';
export type InsecureFlag = 'open' | 'wep' | 'wps' | 'deprecated';
export type ThreatCategory = 'critical' | 'high' | 'medium' | 'low';

export enum TemporalScope {
  OBSERVATION_TIME = 'observation_time', // Default - when observations occurred
  NETWORK_LIFETIME = 'network_lifetime', // first_seen to last_seen
  THREAT_WINDOW = 'threat_window', // When threat was detected
}

export interface TimeframeFilter {
  type: 'absolute' | 'relative';
  startTimestamp?: string; // ISO string
  endTimestamp?: string; // ISO string
  relativeWindow?: '24h' | '7d' | '30d' | '90d' | 'all';
}

export interface BoundingBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface RadiusFilter {
  latitude: number;
  longitude: number;
  radiusMeters: number;
}

// Threat Transparency (MANDATORY)
export interface ThreatEvidence {
  rule: string;
  observedValue: number | string;
  threshold: number | string;
  description: string;
}

export interface ThreatInfo {
  threatReasons: string[];
  threatEvidence: ThreatEvidence[];
  stationaryConfidence: number; // 0.0 → 1.0
}

// Filter State with Explicit Enable/Disable
export interface FilterState {
  filters: NetworkFilters;
  enabled: Record<keyof NetworkFilters, boolean>;
  presets?: Record<string, FilterState>; // Saved filter presets
}

// Backend DTO
export interface FilterQuery {
  where: string[];
  params: any[];
  joins: string[];
  having?: string[];
  orderBy?: string;
}

// Network with Threat Transparency
export interface NetworkWithThreat {
  bssid: string;
  ssid?: string;
  type: RadioType;
  ml_threat_score?: number;
  threat_info?: ThreatInfo;
  // ... other network fields
}
