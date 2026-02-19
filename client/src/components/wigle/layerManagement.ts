/**
 * WiGLE Map Layer Management
 * Handles layer visibility and updates
 */

import type { Map, GeoJSONSource } from 'mapbox-gl';
import { rowsToGeoJSON, EMPTY_FEATURE_COLLECTION } from '../../utils/wigle';
import type { WigleRow } from '../../utils/wigle';

export function updateMapLayers(
  map: Map | null,
  v2Rows: WigleRow[],
  v3Rows: WigleRow[],
  v2Enabled: boolean,
  v3Enabled: boolean,
  v2FCRef: React.MutableRefObject<any>,
  v3FCRef: React.MutableRefObject<any>
) {
  if (!map) return;

  // Update v2 data
  const v2Source = map.getSource('wigle-v2-points') as GeoJSONSource;
  if (v2Source) {
    const v2FC = v2Enabled && v2Rows.length > 0 ? rowsToGeoJSON(v2Rows) : EMPTY_FEATURE_COLLECTION;
    v2FCRef.current = v2FC;
    v2Source.setData(v2FC);
  }

  // Update v3 data
  const v3Source = map.getSource('wigle-v3-points') as GeoJSONSource;
  if (v3Source) {
    const v3FC = v3Enabled && v3Rows.length > 0 ? rowsToGeoJSON(v3Rows) : EMPTY_FEATURE_COLLECTION;
    v3FCRef.current = v3FC;
    v3Source.setData(v3FC);
  }
}

export function setLayerVisibility(map: Map | null, layerId: string, visible: boolean) {
  if (!map || !map.getLayer(layerId)) return;
  map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
}

export function updateLayerVisibilities(
  map: Map | null,
  layers: {
    v2: boolean;
    v3: boolean;
    fieldOffices: boolean;
    residentAgencies: boolean;
  }
) {
  if (!map) return;

  setLayerVisibility(map, 'wigle-v2-clusters', layers.v2);
  setLayerVisibility(map, 'wigle-v2-cluster-count', layers.v2);
  setLayerVisibility(map, 'wigle-v2-unclustered', layers.v2);

  setLayerVisibility(map, 'wigle-v3-clusters', layers.v3);
  setLayerVisibility(map, 'wigle-v3-cluster-count', layers.v3);
  setLayerVisibility(map, 'wigle-v3-unclustered', layers.v3);
}
