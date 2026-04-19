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
          netid: (row as any).netid || row.bssid,
          bssid: row.bssid || (row as any).netid,
          ssid: row.ssid || (row as any).name || '(hidden)',
          type: row.type || 'wifi',
          encryption: row.encryption || 'Unknown',
          capabilities: (row as any).capabilities || row.encryption || null,
          channel: row.channel,
          frequency: row.frequency,
          observed_at: (row as any).observed_at || null,
          firsttime: row.firsttime,
          lasttime: row.lasttime || (row as any).lastupdt,
          lastupdt: (row as any).lastupdt || null,
          accuracy: row.accuracy,
          comment: (row as any).comment || null,
          source: (row as any).source || (row as any).source_file || null,
          manufacturer: (row as any).manufacturer || (row as any).ne_manufacturer || null,
          qos: (row as any).qos || null,
          observation_count:
            (row as any).observation_count || (row as any).wigle_v3_observation_count || null,
          local_observations: (row as any).local_observations || null,
          city: (row as any).city || '',
          region: (row as any).region || '',
          road: (row as any).road || '',
          housenumber: (row as any).housenumber || '',
          geocoded_address: (row as any).geocoded_address || null,
          geocoded_city: (row as any).geocoded_city || null,
          geocoded_state: (row as any).geocoded_state || null,
          geocoded_poi_name: (row as any).geocoded_poi_name || null,
          first_seen: row.firsttime || null,
          last_seen: row.lasttime || (row as any).lastupdt || null,
          local_first_seen: (row as any).local_first_seen || null,
          local_last_seen: (row as any).local_last_seen || null,
          wigle_match: Boolean((row as any).wigle_match),
          localMatchExists: Boolean((row as any).wigle_match),
          localObservationCount:
            (typeof (row as any).local_observations === 'number'
              ? (row as any).local_observations
              : null) ?? null,
          wigle_source: ((row as any).observed_at ? 'wigle-v3' : 'wigle-v2') as
            | 'wigle-v2'
            | 'wigle-v3',
          color: macColor(row.bssid || (row as any).netid),
        },
      };
    }),
  };
}
