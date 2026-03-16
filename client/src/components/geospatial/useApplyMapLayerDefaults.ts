import { useEffect } from 'react';

type ApplyMapLayerDefaultsProps = {
  mapReady: boolean;
  mapRef: React.MutableRefObject<any>;
  show3DBuildings: boolean;
  showTerrain: boolean;
  toggle3DBuildings: (enabled: boolean) => void;
  toggleTerrain: (enabled: boolean) => void;
};

export const useApplyMapLayerDefaults = ({
  mapReady,
  mapRef,
  show3DBuildings,
  showTerrain,
  toggle3DBuildings,
  toggleTerrain,
}: ApplyMapLayerDefaultsProps) => {
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;

    const map = mapRef.current;

    const applyDefaults = () => {
      // Small delay to ensure Mapbox internal state is fully ready for config properties
      setTimeout(() => {
        if (show3DBuildings) {
          toggle3DBuildings(true);
        }
        if (showTerrain) {
          toggleTerrain(true);
        }
      }, 100);
    };

    if (map.isStyleLoaded()) {
      applyDefaults();
    } else {
      map.once('style.load', applyDefaults);
    }
  }, [mapReady, mapRef, show3DBuildings, showTerrain, toggle3DBuildings, toggleTerrain]);
};
