import { useRef, useState } from 'react';
import type { Map } from 'mapbox-gl';
import type * as mapboxglType from 'mapbox-gl';

export const useWigleMapState = () => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const mapboxRef = useRef<typeof mapboxglType | null>(null);

  const [mapReady, setMapReady] = useState(false);
  const [mapError, setError] = useState<string | null>(null);
  const [pointSize, setPointSize] = useState(5);
  const [clusteringEnabled, setClusteringEnabled] = useState(true);

  // Map settings
  const [mapStyle, setMapStyleState] = useState(() => {
    return localStorage.getItem('wigle_map_style') || 'mapbox://styles/mapbox/dark-v11';
  });
  const [show3dBuildings, setShow3dBuildingsState] = useState(() => {
    return localStorage.getItem('wigle_3d_buildings') === 'true';
  });
  const [showTerrain, setShowTerrainState] = useState(() => {
    return localStorage.getItem('wigle_terrain') === 'true';
  });

  const setMapStyle = (style: string) => {
    localStorage.setItem('wigle_map_style', style);
    setMapStyleState(style);
  };
  const setShow3dBuildings = (enabled: boolean) => {
    localStorage.setItem('wigle_3d_buildings', String(enabled));
    setShow3dBuildingsState(enabled);
  };
  const setShowTerrain = (enabled: boolean) => {
    localStorage.setItem('wigle_terrain', String(enabled));
    setShowTerrainState(enabled);
  };

  return {
    mapContainerRef,
    mapRef,
    mapboxRef,
    mapReady,
    setMapReady,
    mapError,
    setError,
    pointSize,
    setPointSize,
    clusteringEnabled,
    setClusteringEnabled,
    mapStyle,
    setMapStyle,
    show3dBuildings,
    setShow3dBuildings,
    showTerrain,
    setShowTerrain,
  };
};
