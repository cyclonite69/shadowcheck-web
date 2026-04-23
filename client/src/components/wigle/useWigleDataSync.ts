import { useEffect } from 'react';
import type { Map, GeoJSONSource } from 'mapbox-gl';
import { logDebug } from '../../../logging/clientLogger';
import { EMPTY_FEATURE_COLLECTION } from '../../../utils/wigle';
import { updateClusterColors } from '../clusterColors';

export function useWigleDataSync({
  mapRef,
  mapboxRef,
  v2FeatureCollection,
  v3FeatureCollection,
  v2FCRef,
  v3FCRef,
  kmlFCRef,
  v2Rows,
  v3Rows,
  kmlRows,
  layersRef,
  clusterColorCache,
  ensureV2LayersCallback,
  ensureV3LayersCallback,
  ensureKmlLayersCallback,
  applyLayerVisibilityCallback,
  layers,
}: any): void {
  // Sync v2 data to map
  useEffect(() => {
    const map = mapRef.current;
    const mapboxgl = mapboxRef.current;
    if (!map || !mapboxgl) return;

    if (!map.getSource('wigle-v2-points')) {
      if (map.isStyleLoaded()) {
        ensureV2LayersCallback();
      } else {
        map.once('style.load', () => {
          ensureV2LayersCallback();
          const source = map.getSource('wigle-v2-points') as GeoJSONSource | undefined;
          if (source) {
            source.setData((v2FCRef.current || EMPTY_FEATURE_COLLECTION) as any);
            updateClusterColors(map, 'wigle-v2-points', 'v2', clusterColorCache);
          }
        });
        return;
      }
    }
    const source = map.getSource('wigle-v2-points') as GeoJSONSource | undefined;
    if (!source) return;
    logDebug(`[WiGLE] Updating v2 map with ${v2Rows.length} points`);
    clusterColorCache.current.v2 = {};
    map.removeFeatureState({ source: 'wigle-v2-points' });
    source.setData(v2FeatureCollection as any);
    updateClusterColors(map, 'wigle-v2-points', 'v2', clusterColorCache);
  }, [v2FeatureCollection, ensureV2LayersCallback]);

  // Sync v3 data to map
  useEffect(() => {
    const map = mapRef.current;
    const mapboxgl = mapboxRef.current;
    if (!map || !mapboxgl) return;
    if (!map.getSource('wigle-v3-points')) {
      if (map.isStyleLoaded()) {
        ensureV3LayersCallback();
      } else {
        map.once('style.load', () => {
          ensureV3LayersCallback();
          const source = map.getSource('wigle-v3-points') as GeoJSONSource | undefined;
          if (source) {
            source.setData((v3FCRef.current || EMPTY_FEATURE_COLLECTION) as any);
            updateClusterColors(map, 'wigle-v3-points', 'v3', clusterColorCache);
          }
        });
        return;
      }
    }
    const source = map.getSource('wigle-v3-points') as GeoJSONSource | undefined;
    if (!source) return;
    logDebug(`[WiGLE] Updating v3 map with ${v3Rows.length} points`);
    clusterColorCache.current.v3 = {};
    map.removeFeatureState({ source: 'wigle-v3-points' });
    source.setData(v3FeatureCollection as any);
    updateClusterColors(map, 'wigle-v3-points', 'v3', clusterColorCache);
  }, [v3FeatureCollection, ensureV3LayersCallback]);

  // Sync KML data to map
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!map.getSource('wigle-kml-points')) {
      if (map.isStyleLoaded()) {
        ensureKmlLayersCallback();
      } else {
        map.once('style.load', () => {
          ensureKmlLayersCallback();
          // Import updateKmlLayerData here or pass as prop
        });
        return;
      }
    }
  }, [ensureKmlLayersCallback]);

  // Fit bounds
  useEffect(() => {
    const map = mapRef.current;
    const mapboxgl = mapboxRef.current;
    if (!map || !mapboxgl) return;
    const allRows = [...v2Rows, ...v3Rows];
    if (allRows.length === 0) return;
    const coords = allRows
      .map((row) => [
        Number(row.trilong ?? row.trilon ?? row.longitude),
        Number(row.trilat ?? row.latitude),
      ])
      .filter(([lon, lat]) => !isNaN(lon) && !isNaN(lat));
    if (coords.length === 0) return;
    const bounds = coords.reduce(
      (acc, coord) => acc.extend(coord as any),
      new mapboxgl.LngLatBounds(coords[0] as any, coords[0] as any)
    );
    map.fitBounds(bounds, { padding: 60, maxZoom: 12, duration: 700 });
  }, [v2Rows, v3Rows]);

  // Layer visibility
  useEffect(() => {
    applyLayerVisibilityCallback();
  }, [layers.v2, layers.v3, layers.kml, applyLayerVisibilityCallback]);
}
