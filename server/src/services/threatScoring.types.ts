export type ThreatLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
export type ThreatApiLevel = 'critical' | 'high' | 'medium' | 'low' | 'none';
export type LegacyThreatLevel = ThreatLevel | 'MED';

export interface ThreatScoringStats {
  totalProcessed: number;
  totalUpdated: number;
  averageExecutionTime: number;
  lastError: string | null;
}

export interface ComputeThreatScoresResult {
  success?: boolean;
  skipped?: boolean;
  processed?: number;
  updated?: number;
  executionTimeMs?: number;
}

export interface MarkForRecomputeResult {
  success: boolean;
  rowsAffected: number;
}

export interface ThreatScoringFullStats extends ThreatScoringStats {
  isRunning: boolean;
  lastRun: Date | null;
}

export interface ThreatScoringBatchRequest {
  batchSize: number;
  maxAgeHours: number;
}

export interface ThreatRuleBasedBatchResult {
  processedBssids: string[];
  processedCount: number;
}

export interface ThreatQuickThreatsQuery {
  limit: number;
  offset: number;
  minObservations: number;
  minUniqueDays: number;
  minUniqueLocations: number;
  minRangeKm: number;
  minThreatScore: number;
  minTimestamp: number;
}

export interface ThreatQuickThreatRecord {
  bssid: string | null;
  ssid: string | null;
  radioType: string | null;
  channel: number | null;
  signalDbm: number | null;
  encryption: string | null;
  latitude: number | null;
  longitude: number | null;
  firstSeen: unknown;
  lastSeen: unknown;
  observations: number;
  uniqueDays: number;
  uniqueLocations: number;
  distanceRangeKm: number | null;
  threatScore: number;
  threatLevel: ThreatLevel;
}

export interface ThreatQuickThreatDto {
  bssid: string | null;
  ssid: string;
  radioType: string;
  type: string;
  channel: number | null;
  signal: number | null;
  signalDbm: number | null;
  maxSignal: number | null;
  encryption: string | null;
  latitude: number | null;
  longitude: number | null;
  firstSeen: unknown;
  lastSeen: unknown;
  observations: number;
  totalObservations: number;
  uniqueDays: number;
  uniqueLocations: number;
  distanceRangeKm: string | null;
  threatScore: number;
  threatLevel: ThreatApiLevel;
}

export interface ThreatQuickThreatPage {
  threats: ThreatQuickThreatDto[];
  totalCount: number;
}

export interface ThreatRuleBasedFlags {
  metrics?: Record<string, unknown>;
  factors?: Record<string, unknown>;
  flags?: unknown[];
  summary?: string;
  confidence?: string | number | null;
  [key: string]: unknown;
}

export interface ThreatDetailedThreatRecord {
  bssid: string | null;
  ssid: string | null;
  type: string | null;
  encryption: string | null;
  frequency: number | null;
  signalDbm: number | null;
  latitude: number | null;
  longitude: number | null;
  totalObservations: number;
  finalThreatScore: number;
  finalThreatLevel: ThreatLevel;
  ruleBasedFlags: ThreatRuleBasedFlags;
}

export interface ThreatDetailedThreatDto {
  bssid: string | null;
  ssid: string | null;
  type: string | null;
  encryption: string | null;
  channel: number | null;
  signal: number | null;
  signalDbm: number | null;
  latitude: number | null;
  longitude: number | null;
  totalObservations: number;
  observations: number;
  threatScore: number;
  threatType: string;
  threatLevel: ThreatApiLevel;
  confidence: string | null;
  patterns: {
    metrics: Record<string, unknown>;
    factors: Record<string, unknown>;
    flags: unknown[];
  };
}

export interface ThreatManualTag {
  bssid: string;
  threat_tag: 'FALSE_POSITIVE' | 'THREAT' | 'SUSPECT' | 'INVESTIGATE' | string;
  threat_confidence?: number;
  notes?: string | null;
}

export interface ThreatBehavioralCandidate {
  bssid: string;
  observationCount: number;
  uniqueDays: number;
  maxDistanceKm: number;
}

export interface ThreatBehavioralScoreInput {
  bssid: string;
  mlThreatScore: number;
  mlThreatProbability: number;
  mlPrimaryClass: string;
  modelVersion: string | null;
}

export interface ThreatScoringRepository {
  upsertRuleBasedThreatScores(
    request: ThreatScoringBatchRequest
  ): Promise<ThreatRuleBasedBatchResult>;
  getBehavioralScoringCandidatesByBssids(params: {
    bssids: string[];
    minObservations: number;
    maxBssidLength: number;
  }): Promise<ThreatBehavioralCandidate[]>;
  upsertBehavioralThreatScores(scores: ThreatBehavioralScoreInput[]): Promise<number>;
  getQuickThreats(query: ThreatQuickThreatsQuery): Promise<ThreatQuickThreatPageRecord>;
  getDetailedThreats(): Promise<ThreatDetailedThreatRecord[]>;
}

export interface ThreatQuickThreatPageRecord {
  records: ThreatQuickThreatRecord[];
  totalCount: number;
}
