import { useCallback, useEffect } from 'react';
import type { GeoJSONSource, Map } from 'mapbox-gl';
import type * as mapboxglType from 'mapbox-gl';
import {
  ensureFieldDataLayer,
  ensureV2Layers,
  ensureV3Layers,
  applyLayerVisibility,
  setPointRadius,
  updateFieldDataSource,
} from './mapLayers';
import { ensureKmlLayers } from './kmlLayers';
import { attachClickHandlers } from './mapHandlers';
import { updateAllClusterColors } from './clusterColors';
import { apply3dBuildings, applyTerrain, runWhenStyleReady } from './mapLifecycle';
import { resetAgencyOfficeLayers, type AgencyVisibility } from '../hooks/useAgencyOffices';
import { resetFederalCourthouseLayers } from '../hooks/useFederalCourthouses';
import { ensureDeflockLayers } from '../hooks/useDeflockCameras';
import { ensureShotspotterLayers } from '../hooks/useShotspotterZones';
import { ensureShotspotterSensorLayers } from '../hooks/useShotspotterSensors';
import { ensureHomeLocationLayers } from '../../utils/mapHelpers';

export interface UseWigleOverlayManagerParams {
  mapRef: React.RefObject<Map | null>;
  mapboxRef: React.RefObject<typeof mapboxglType | null>;
  mapReady: boolean;
  layers: any;
  layersRef: React.MutableRefObject<any>;
  clusteringEnabled: boolean;
  clusteringEnabledRef: React.MutableRefObject<boolean>;
  v2FCRef: React.MutableRefObject<any>;
  v3FCRef: React.MutableRefObject<any>;
  kmlFCRef: React.MutableRefObject<any>;
  fieldDataFCRef: React.MutableRefObject<any>;
  clusterColorCache: React.MutableRefObject<Record<string, Record<number, string>>>;
  wigleHandlersAttachedRef: React.MutableRefObject<boolean>;
  agencyData: any;
  agencyVisibility: AgencyVisibility;
  courthouseData: any;
  deflockData: any;
  shotspotterData: any;
  shotspotterSensorsData: any;
  homeLocation: { center: [number, number]; radius: number };
  pointSize: number;
  mapStyle: string;
  show3dBuildings: boolean;
  showTerrain: boolean;
}

export function useWigleOverlayManager({
  mapRef,
  mapboxRef,
  mapReady,
  layers,
  layersRef,
  clusteringEnabled,
  clusteringEnabledRef,
  v2FCRef,
  v3FCRef,
  kmlFCRef,
  fieldDataFCRef,
  clusterColorCache,
  wigleHandlersAttachedRef,
  agencyData,
  agencyVisibility,
  courthouseData,
  deflockData,
  shotspotterData,
  shotspotterSensorsData,
  homeLocation,
  pointSize,
  mapStyle,
  show3dBuildings,
  showTerrain,
}: UseWigleOverlayManagerParams) {
  const updateAllClusterColorsCallback = useCallback(() => {
    if (mapRef.current) {
      updateAllClusterColors(mapRef.current, clusterColorCache);
    }
  }, [mapRef, clusterColorCache]);

  const ensureV2LayersCallback = useCallback(() => {
    if (mapRef.current) {
      ensureV2Layers(mapRef.current, v2FCRef, clusteringEnabledRef.current);
    }
  }, [mapRef, v2FCRef, clusteringEnabledRef]);

  const ensureV3LayersCallback = useCallback(() => {
    if (mapRef.current) {
      ensureV3Layers(mapRef.current, v3FCRef, clusteringEnabledRef.current);
    }
  }, [mapRef, v3FCRef, clusteringEnabledRef]);

  const ensureKmlLayersCallback = useCallback(() => {
    if (mapRef.current) {
      ensureKmlLayers(mapRef.current, kmlFCRef, clusteringEnabledRef.current);
    }
  }, [mapRef, kmlFCRef, clusteringEnabledRef]);

  const ensureAllLayers = useCallback(() => {
    ensureV2LayersCallback();
    ensureV3LayersCallback();
    ensureKmlLayersCallback();
  }, [ensureV2LayersCallback, ensureV3LayersCallback, ensureKmlLayersCallback]);

  const applyLayerVisibilityCallback = useCallback(() => {
    if (mapRef.current) {
      applyLayerVisibility(mapRef.current, layersRef.current);
    }
  }, [mapRef, layersRef]);

  const attachClickHandlersCallback = useCallback(() => {
    if (mapRef.current && mapboxRef.current) {
      attachClickHandlers(mapRef.current, mapboxRef.current, wigleHandlersAttachedRef);
    }
  }, [mapRef, mapboxRef, wigleHandlersAttachedRef]);

  const applyEnabledWigleOverlays = useCallback(
    (reason: string) => {
      const map = mapRef.current;
      if (!map) {
        return undefined;
      }

      return runWhenStyleReady(map, reason, () => {
        const currentLayers = layersRef.current;
        const clustering = clusteringEnabledRef.current;

        ensureAllLayers();
        attachClickHandlersCallback();

        const v2Source = map.getSource('wigle-v2-points') as GeoJSONSource | undefined;
        if (v2Source && v2FCRef.current) {
          clusterColorCache.current.v2 = {};
          map.removeFeatureState({ source: 'wigle-v2-points' });
          v2Source.setData(v2FCRef.current);
        }

        const v3Source = map.getSource('wigle-v3-points') as GeoJSONSource | undefined;
        if (v3Source && v3FCRef.current) {
          clusterColorCache.current.v3 = {};
          map.removeFeatureState({ source: 'wigle-v3-points' });
          v3Source.setData(v3FCRef.current);
        }

        const kmlSource = map.getSource('wigle-kml-points') as GeoJSONSource | undefined;
        if (kmlSource && kmlFCRef.current) {
          kmlSource.setData(kmlFCRef.current);
        }

        if (currentLayers.showFieldData && fieldDataFCRef.current) {
          ensureFieldDataLayer(map, fieldDataFCRef, clustering);
          updateFieldDataSource(map, fieldDataFCRef.current);
        }

        resetAgencyOfficeLayers(map, agencyData, agencyVisibility, clustering);
        resetFederalCourthouseLayers(
          map,
          courthouseData,
          currentLayers.federalCourthouses,
          clustering
        );

        if (currentLayers.deflockCameras && deflockData?.features?.length) {
          ensureDeflockLayers(map, deflockData, clustering);
        }
        if (currentLayers.shotspotterZones && shotspotterData?.features?.length) {
          ensureShotspotterLayers(map, shotspotterData);
        }
        if (currentLayers.shotspotterSensors && shotspotterSensorsData?.features?.length) {
          ensureShotspotterSensorLayers(map, shotspotterSensorsData);
        }

        ensureHomeLocationLayers(map, homeLocation, currentLayers.homeArea);

        setPointRadius(map, pointSize);
        applyLayerVisibilityCallback();
        updateAllClusterColorsCallback();
        apply3dBuildings(map, mapStyle, show3dBuildings);
        applyTerrain(map, mapStyle, showTerrain);
      });
    },
    [
      agencyData,
      agencyVisibility,
      applyLayerVisibilityCallback,
      attachClickHandlersCallback,
      clusterColorCache,
      courthouseData,
      deflockData,
      ensureAllLayers,
      fieldDataFCRef,
      homeLocation,
      kmlFCRef,
      layersRef,
      mapRef,
      mapStyle,
      pointSize,
      shotspotterData,
      shotspotterSensorsData,
      show3dBuildings,
      showTerrain,
      updateAllClusterColorsCallback,
      v2FCRef,
      v3FCRef,
      clusteringEnabledRef,
    ]
  );

  useEffect(() => {
    if (!mapReady) {
      return undefined;
    }
    return applyEnabledWigleOverlays('overlay-state-change');
  }, [
    applyEnabledWigleOverlays,
    clusteringEnabled,
    layers.deflockCameras,
    layers.federalCourthouses,
    layers.fieldOffices,
    layers.kml,
    layers.residentAgencies,
    layers.shotspotterSensors,
    layers.shotspotterZones,
    layers.showFieldData,
    layers.v2,
    layers.v3,
    layers.homeArea,
    homeLocation,
    mapReady,
    pointSize,
    show3dBuildings,
    showTerrain,
  ]);

  return {
    ensureAllLayers,
    ensureV2LayersCallback,
    ensureV3LayersCallback,
    ensureKmlLayersCallback,
    applyLayerVisibilityCallback,
    attachClickHandlersCallback,
    updateAllClusterColorsCallback,
    applyEnabledWigleOverlays,
  };
}
