import type { GeoJSONSource, Map } from 'mapbox-gl';
import { EMPTY_FEATURE_COLLECTION } from '../../utils/wigle';
import type { WigleKmlRow } from './useWigleKmlData';

export function kmlRowsToGeoJSON(rows: WigleKmlRow[]) {
  return {
    type: 'FeatureCollection' as const,
    features: rows
      .filter((row) => Number.isFinite(row.latitude) && Number.isFinite(row.longitude))
      .map((row) => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [Number(row.longitude), Number(row.latitude)],
        },
        properties: {
          id: row.id,
          bssid: row.bssid || row.network_id || row.name || 'KML',
          ssid: row.ssid || row.name || row.folder_name || 'KML Point',
          type: row.network_type || 'KML',
          observed_at: row.observed_at,
          accuracy: row.accuracy_m,
          signal_dbm: row.signal_dbm,
          source_file: row.source_file,
          folder_name: row.folder_name,
          color: '#f97316',
        },
      })),
  };
}

export function ensureKmlLayers(map: Map, kmlFCRef: any) {
  if (!map.getSource('wigle-kml-points')) {
    map.addSource('wigle-kml-points', {
      type: 'geojson',
      data: kmlFCRef.current || EMPTY_FEATURE_COLLECTION,
      cluster: true,
      clusterMaxZoom: 13,
      clusterRadius: 38,
    });
  }

  if (!map.getLayer('wigle-kml-clusters')) {
    map.addLayer({
      id: 'wigle-kml-clusters',
      type: 'circle',
      source: 'wigle-kml-points',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': '#f97316',
        'circle-opacity': 0.72,
        'circle-radius': ['step', ['get', 'point_count'], 18, 100, 26, 750, 34],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#7c2d12',
      },
    });
  }

  if (!map.getLayer('wigle-kml-cluster-count')) {
    map.addLayer({
      id: 'wigle-kml-cluster-count',
      type: 'symbol',
      source: 'wigle-kml-points',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': ['get', 'point_count_abbreviated'],
        'text-size': 12,
        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
      },
      paint: {
        'text-color': '#111827',
      },
    });
  }

  if (!map.getLayer('wigle-kml-unclustered')) {
    map.addLayer({
      id: 'wigle-kml-unclustered',
      type: 'circle',
      source: 'wigle-kml-points',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-color': '#fb923c',
        'circle-opacity': 0.85,
        'circle-radius': 3.5,
        'circle-stroke-width': 1,
        'circle-stroke-color': '#431407',
      },
    });
  }
}

export function updateKmlLayerData(
  map: Map | null,
  rows: WigleKmlRow[],
  enabled: boolean,
  kmlFCRef: any
) {
  if (!map) return;
  const source = map.getSource('wigle-kml-points') as GeoJSONSource | undefined;
  if (!source) return;

  const fc = enabled && rows.length > 0 ? kmlRowsToGeoJSON(rows) : EMPTY_FEATURE_COLLECTION;
  kmlFCRef.current = fc;
  source.setData(fc as any);
}
