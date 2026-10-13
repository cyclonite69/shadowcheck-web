import type { Map } from 'mapbox-gl';
import type * as mapboxglType from 'mapbox-gl';
import { useGeospatialMenuMvtLayers } from './useGeospatialMenuMvtLayers';

interface GeospatialWigleLayerVisibility {
  v2: boolean;
  v3: boolean;
  kml: boolean;
  fieldObservations: boolean;
  alpr: boolean;
  shotspotterZones: boolean;
  shotspotterSensors: boolean;
}

interface UseGeospatialWigleResultLayersProps {
  mapRef: React.MutableRefObject<Map | null>;
  mapboxRef: React.MutableRefObject<typeof mapboxglType | null>;
  mapReady: boolean;
  visible: GeospatialWigleLayerVisibility;
}

/** Set up the persistent Geospatial Explorer menu overlays as MVT layers. */
export function useGeospatialWigleResultLayers({
  mapRef,
  mapboxRef,
  mapReady,
  visible,
}: UseGeospatialWigleResultLayersProps) {
  useGeospatialMenuMvtLayers({
    mapRef,
    mapboxRef,
    mapReady,
    visible: {
      wigleV2: visible.v2,
      wigleV3: visible.v3,
      kml: visible.kml,
      fieldObservations: visible.fieldObservations,
      alpr: visible.alpr,
      shotspotterZones: visible.shotspotterZones,
      shotspotterSensors: visible.shotspotterSensors,
    },
  });

  return { loading: false, error: null, featureCount: 0 };
}
