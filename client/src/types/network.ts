// Network-related type definitions for ShadowCheck

export type ThreatInfo = {
  score: number;
  level: 'NONE' | 'LOW' | 'MED' | 'HIGH';
  summary: string;
  flags?: string[];
  debug?: {
    rule_score: number;
    ml_score: number;
    evidence_weight: number;
    ml_boost: number;
    features: any;
  };
  signals?: Array<{
    code: string;
    weight: number;
    evidence: any;
  }>;
};

export type ThreatEvidence = {
  rule: string;
  observedValue: number | string | null;
  threshold: number | string | null;
};

export type NetworkTag = {
  bssid: string;
  is_ignored: boolean;
  ignore_reason: string | null;
  threat_tag: 'THREAT' | 'SUSPECT' | 'FALSE_POSITIVE' | 'INVESTIGATE' | null;
  notes: string | null;
  exists: boolean;
};

export type NetworkRow = {
  bssid: string;
  ssid: string;
  type: 'W' | 'E' | 'B' | 'G' | 'C' | 'D' | 'L' | 'N' | 'F' | '?' | null;
  signal: number | null;
  security: string | null;
  frequency: number | null;
  channel?: number | null;
  observations: number;
  latitude: number | null;
  longitude: number | null;
  rawLatitude?: number | null;
  rawLongitude?: number | null;
  distanceFromHome?: number | null;
  accuracy?: number | null;
  firstSeen?: string | null;
  lastSeen: string | null;
  timespanDays?: number | null;
  threat?: ThreatInfo | null;
  threat_score?: number | null;
  threat_level?: string | null;
  threat_rule_score?: number | null;
  threat_ml_score?: number | null;
  threat_ml_weight?: number | null;
  threat_ml_boost?: number | null;
  threatReasons?: string[];
  threatEvidence?: ThreatEvidence[];
  stationaryConfidence?: number | null;
  // Enrichment fields (networks-v2 API)
  manufacturer?: string | null;
  min_altitude_m?: number | null;
  max_altitude_m?: number | null;
  altitude_span_m?: number | null;
  max_distance_meters?: number | null;
  last_altitude_m?: number | null;
  is_sentinel?: boolean | null;
};

export type Observation = {
  id: string | number;
  bssid: string;
  lat: number;
  lon: number;
  signal?: number | null;
  time?: string;
  frequency?: number | null;
  altitude?: number | null;
  acc?: number | null;
  distance_from_home_km?: number | null;
};

export type ContextMenuState = {
  visible: boolean;
  x: number;
  y: number;
  network: NetworkRow | null;
  tag: NetworkTag | null;
};

export type SortState = {
  column: keyof NetworkRow;
  direction: 'asc' | 'desc';
};

// Network type labels and colors for badges
export type NetworkType = NetworkRow['type'];
