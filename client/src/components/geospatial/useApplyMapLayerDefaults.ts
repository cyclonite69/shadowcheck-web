import { useEffect } from 'react';

type ApplyMapLayerDefaultsProps = {
  mapReady: boolean;
  show3DBuildings: boolean;
  showTerrain: boolean;
  toggle3DBuildings: (enabled: boolean) => void;
  toggleTerrain: (enabled: boolean) => void;
};

export const useApplyMapLayerDefaults = ({
  mapReady,
  show3DBuildings,
  showTerrain,
  toggle3DBuildings,
  toggleTerrain,
}: ApplyMapLayerDefaultsProps) => {
  useEffect(() => {
    if (!mapReady) return;

    // Apply 3D buildings state (explicitly handles ON or OFF)
    toggle3DBuildings(show3DBuildings);

    // Apply terrain state (explicitly handles ON or OFF)
    toggleTerrain(showTerrain);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady]);
};
