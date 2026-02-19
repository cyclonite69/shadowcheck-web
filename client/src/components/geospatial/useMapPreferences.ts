import { useState, Dispatch, SetStateAction } from 'react';

type MapPreferences = {
  mapStyle: string;
  setMapStyle: Dispatch<SetStateAction<string>>;
  show3DBuildings: boolean;
  setShow3DBuildings: Dispatch<SetStateAction<boolean>>;
  showTerrain: boolean;
  setShowTerrain: Dispatch<SetStateAction<boolean>>;
};

export const useMapPreferences = (): MapPreferences => {
  const [mapStyle, setMapStyleState] = useState<string>(() => {
    return localStorage.getItem('shadowcheck_map_style') || 'mapbox://styles/mapbox/dark-v11';
  });
  const [show3DBuildings, setShow3DBuildingsState] = useState<boolean>(() => {
    return localStorage.getItem('shadowcheck_show_3d_buildings') === 'true';
  });
  const [showTerrain, setShowTerrainState] = useState<boolean>(() => {
    return localStorage.getItem('shadowcheck_show_terrain') === 'true';
  });

  return {
    mapStyle,
    setMapStyle: setMapStyleState,
    show3DBuildings,
    setShow3DBuildings: setShow3DBuildingsState,
    showTerrain,
    setShowTerrain: setShowTerrainState,
  };
};
