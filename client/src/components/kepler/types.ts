/**
 * Kepler.gl Types
 */

export type NetworkData = {
  position: [number, number];
  bssid: string;
  ssid: string;
  signal: number;
  level: number;
  encryption: string;
  channel: number;
  frequency: number;
  manufacturer: string;
  device_type: string;
  type: string;
  capabilities: string;
  timestamp: string;
  last_seen: string;
  device_id?: string;
  source_tag?: string;
  accuracy?: number;
  altitude?: number;
  obs_count?: number;
  threat_level?: string;
  threat_score?: number;
  is_suspicious?: boolean;
  distance_from_home?: number;
  [key: string]: unknown;
};

export type LayerType = 'scatterplot' | 'heatmap' | 'hexagon';
export type DrawMode = 'none' | 'rectangle' | 'polygon' | 'circle';
