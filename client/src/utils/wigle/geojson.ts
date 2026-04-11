import { macColor } from './colors';

export type WigleRow = {
  bssid: string;
  ssid: string | null;
  trilat: number;
  trilong: number;
  type: string;
  encryption: string | null;
  channel?: number | null;
  frequency?: number | null;
  firsttime?: string | null;
  lasttime: string;
  accuracy?: number | null;
};

export const EMPTY_FEATURE_COLLECTION = {
  type: 'FeatureCollection' as const,
  features: [] as any[],
};

/**
 * Convert WiGLE rows to GeoJSON FeatureCollection
 */
export function rowsToGeoJSON(rows: WigleRow[]) {
  const validRows = rows.filter((row) => {
    const lat = row.trilat || (row as any).lat || (row as any).latitude;
    const lon = row.trilong || (row as any).trilon || (row as any).lon || (row as any).longitude;
    return lat != null && lon != null;
  });

  return {
    type: 'FeatureCollection' as const,
    features: validRows.map((row) => {
      const lat = row.trilat || (row as any).lat || (row as any).latitude;
      const lon = row.trilong || (row as any).trilon || (row as any).lon || (row as any).longitude;

      return {
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [Number(lon), Number(lat)],
        },
        properties: {
          bssid: row.bssid || (row as any).netid,
          ssid: row.ssid || (row as any).name || '(hidden)',
          type: row.type || 'wifi',
          encryption: row.encryption || 'Unknown',
          channel: row.channel,
          frequency: row.frequency,
          firsttime: row.firsttime,
          lasttime: row.lasttime || (row as any).lastupdt,
          accuracy: row.accuracy,
          comment: (row as any).comment || null,
          source: (row as any).source || (row as any).source_file || null,
          manufacturer: (row as any).manufacturer || null,
          qos: (row as any).qos || null,
          observation_count:
            (row as any).observation_count || (row as any).wigle_v3_observation_count || null,
          city: (row as any).city || '',
          region: (row as any).region || '',
          road: (row as any).road || '',
          housenumber: (row as any).housenumber || '',
          color: macColor(row.bssid || (row as any).netid),
        },
      };
    }),
  };
}
