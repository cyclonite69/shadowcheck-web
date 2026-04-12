/**
 * Filter Query Builder Types
 * Shared type definitions for the filter query builder module.
 */

import type { FilterKey } from './constants';

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

export interface Timeframe {
  type: 'absolute' | 'relative';
  startTimestamp?: string;
  endTimestamp?: string;
  relativeWindow?: '24h' | '7d' | '30d' | '90d' | 'all';
}

export interface Filters {
  ssid?: string;
  bssid?: string;
  manufacturer?: string;
  radioTypes?: string[];
  frequencyBands?: string[];
  channelMin?: number;
  channelMax?: number;
  rssiMin?: number;
  rssiMax?: number;
  encryptionTypes?: string[];
  securityFlags?: string[];
  timeframe?: Timeframe;
  temporalScope?:
    | 'observation_time'
    | 'network_lifetime'
    | 'threat_window'
    | 'first_seen'
    | 'last_seen';
  observationCountMin?: number;
  observationCountMax?: number;
  has_notes?: boolean;
  tag_type?: string[];
  wigle_v3_observation_count_min?: number;
  wigle_v3_observation_count_max?: number;
  gpsAccuracyMax?: number;
  excludeInvalidCoords?: boolean;
  qualityFilter?: 'none' | 'temporal' | 'extreme' | 'duplicate' | 'all';
  distanceFromHomeMin?: number;
  distanceFromHomeMax?: number;
  boundingBox?: BoundingBox;
  radiusFilter?: RadiusFilter;
  threatScoreMin?: number;
  threatScoreMax?: number;
  threatCategories?: string[];
  stationaryConfidenceMin?: number;
  stationaryConfidenceMax?: number;
  geocodedAddress?: string;
  geocodedCity?: string;
  geocodedState?: string;
  geocodedPostalCode?: string;
  geocodedCountry?: string;
  geocodedPoiName?: string;
  geocodedPoiCategory?: string;
  geocodedFeatureType?: string;
  geocodedProvider?: string;
  geocodedConfidenceMin?: number;
  geocodedConfidenceMax?: number;
  uniqueDaysMin?: number;
  uniqueDaysMax?: number;
  uniqueLocationsMin?: number;
  uniqueLocationsMax?: number;
  ruleBasedScoreMin?: number;
  ruleBasedScoreMax?: number;
  mlThreatScoreMin?: number;
  mlThreatScoreMax?: number;
  mlWeightMin?: number;
  mlWeightMax?: number;
  mlBoostMin?: number;
  mlBoostMax?: number;
  modelVersion?: string[];
  maxDistanceMetersMin?: number;
  maxDistanceMetersMax?: number;
  wigleV3LastImportBefore?: string;
  wigleV3LastImportAfter?: string;
}

export type EnabledFlags = Record<FilterKey, boolean>;

export interface AppliedFilter {
  type: string;
  field: string;
  value: unknown;
}

export interface IgnoredFilter {
  type: string;
  field: string;
  reason: string;
}

export interface QueryResult {
  sql: string;
  params: unknown[];
}

export interface FilteredQueryResult extends QueryResult {
  appliedFilters: AppliedFilter[];
  ignoredFilters: IgnoredFilter[];
  warnings: string[];
}

export interface ValidationResult {
  errors: string[];
  filters: Filters;
  enabled: EnabledFlags;
}

export interface CteResult {
  cte: string;
  params: unknown[];
}

export interface ObservationFiltersResult {
  where: string[];
  joins: string[];
}

export interface NetworkListOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  locationMode?: 'latest_observation' | 'centroid' | 'weighted_centroid';
}

export interface GeospatialOptions {
  limit?: number | null;
  offset?: number;
  selectedBssids?: string[];
  locationMode?: 'latest_observation' | 'centroid' | 'weighted_centroid';
}

export interface AnalyticsOptions {
  useLatestPerBssid?: boolean;
}

export interface AnalyticsQueries {
  networkTypes: QueryResult;
  signalStrength: QueryResult;
  security: QueryResult;
  threatDistribution: QueryResult;
  temporalActivity: QueryResult;
  radioTypeOverTime: QueryResult;
  threatTrends: QueryResult;
  topNetworks: QueryResult;
}
