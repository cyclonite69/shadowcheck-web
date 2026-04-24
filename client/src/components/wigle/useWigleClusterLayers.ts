import { useEffect, type MutableRefObject } from 'react';
import type { Map, GeoJSONSource } from 'mapbox-gl';
import { resetAgencyOfficeLayers } from '../hooks/useAgencyOffices';
import type { AgencyVisibility } from '../hooks/useAgencyOffices';
import { resetFederalCourthouseLayers } from '../hooks/useFederalCourthouses';
import { resetKmlLayers } from './kmlLayers';
import { resetV2Layers, resetV3Layers, resetFieldDataLayers, FIELD_DATA_SOURCE } from './mapLayers';

interface UseWigleClusterLayersProps {
  mapRef: MutableRefObject<Map | null>;
  mapReady: boolean;
  clusteringEnabled: boolean;
  clusteringChangedRef: MutableRefObject<boolean>;
  v2FCRef: MutableRefObject<any>;
  v3FCRef: MutableRefObject<any>;
  kmlFCRef: MutableRefObject<any>;
  fieldDataFCRef: MutableRefObject<any>;
  agencyData: any;
  agencyVisibility: AgencyVisibility;
  courthouseData: any;
  federalCourthousesVisible: boolean;
  applyLayerVisibilityCallback: () => void;
  updateAllClusterColorsCallback: () => void;
}

export const useWigleClusterLayers = ({
  mapRef,
  mapReady,
  clusteringEnabled,
  clusteringChangedRef,
  v2FCRef,
  v3FCRef,
  kmlFCRef,
  fieldDataFCRef,
  agencyData,
  agencyVisibility,
  courthouseData,
  federalCourthousesVisible,
  applyLayerVisibilityCallback,
  updateAllClusterColorsCallback,
}: UseWigleClusterLayersProps) => {
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (!clusteringChangedRef.current) {
      clusteringChangedRef.current = true;
      return;
    }
    if (!map.isStyleLoaded()) return;

    resetV2Layers(map, v2FCRef, clusteringEnabled);
    const v2Src = map.getSource('wigle-v2-points') as GeoJSONSource | undefined;
    if (v2Src && v2FCRef.current) v2Src.setData(v2FCRef.current);

    resetV3Layers(map, v3FCRef, clusteringEnabled);
    const v3Src = map.getSource('wigle-v3-points') as GeoJSONSource | undefined;
    if (v3Src && v3FCRef.current) v3Src.setData(v3FCRef.current);

    resetKmlLayers(map, kmlFCRef, clusteringEnabled);
    const kmlSrc = map.getSource('wigle-kml-points') as GeoJSONSource | undefined;
    if (kmlSrc && kmlFCRef.current) kmlSrc.setData(kmlFCRef.current);

    if (map.getSource(FIELD_DATA_SOURCE)) {
      resetFieldDataLayers(map, fieldDataFCRef, clusteringEnabled);
      const fieldSrc = map.getSource(FIELD_DATA_SOURCE) as GeoJSONSource | undefined;
      if (fieldSrc && fieldDataFCRef.current) fieldSrc.setData(fieldDataFCRef.current);
    }

    resetAgencyOfficeLayers(map, agencyData, agencyVisibility, clusteringEnabled);
    resetFederalCourthouseLayers(map, courthouseData, federalCourthousesVisible, clusteringEnabled);

    applyLayerVisibilityCallback();
    updateAllClusterColorsCallback();
  }, [
    agencyData,
    agencyVisibility,
    applyLayerVisibilityCallback,
    clusteringChangedRef,
    clusteringEnabled,
    courthouseData,
    federalCourthousesVisible,
    fieldDataFCRef,
    kmlFCRef,
    mapReady,
    mapRef,
    updateAllClusterColorsCallback,
    v2FCRef,
    v3FCRef,
  ]);
};
