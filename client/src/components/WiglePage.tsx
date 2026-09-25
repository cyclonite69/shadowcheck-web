import { usePageFilters } from '../hooks/usePageFilters';
import React, { useMemo, useRef, useState, useEffect } from 'react';
import type { Map } from 'mapbox-gl';
import type * as mapboxglType from 'mapbox-gl';
import { AppHeader } from './AppHeader';
import { WigleControlPanel } from './WigleControlPanel';
import { FilterPanelContainer } from './FilterPanelContainer';
import { WigleMap } from './WigleMap';
import { useFilterURLSync } from '../hooks/useFilterURLSync';
import { useAdaptedFilters } from '../hooks/useAdaptedFilters';
import { getPageCapabilities } from '../utils/filterCapabilities';
import { useAgencyOffices } from './hooks/useAgencyOffices';
import type { AgencyVisibility } from './hooks/useAgencyOffices';
import { useFederalCourthouses } from './hooks/useFederalCourthouses';
import { useDeflockCameras } from './hooks/useDeflockCameras';
import { useShotspotterZones } from './hooks/useShotspotterZones';
import { useShotspotterSensors } from './hooks/useShotspotterSensors';
import { useWigleLayers } from './wigle/useWigleLayers';
import { useWigleData } from './wigle/useWigleData';
import { useWigleClusterLayers } from './wigle/useWigleClusterLayers';
import { useWigleKmlData } from './wigle/useWigleKmlData';
import { useWigleFieldData } from './wigle/useWigleFieldData';
import { useWigleMapInit } from './wigle/useWigleMapInit';
import { kmlRowsToGeoJSON } from './wigle/kmlLayers';
import { rowsToGeoJSON, DEFAULT_LIMIT, MAP_STYLES } from '../utils/wigle';
import { useWigleDataSync } from './wigle/useWigleDataSync';
import { useWigleAutoFetch } from './wigle/useWigleAutoFetch';
import { useWigleMapFeatures } from './wigle/useWigleMapFeatures';
import { useWigleResize } from './wigle/useWigleResize';
import { useHomeLocationLayer } from './geospatial/hooks/useHomeLocationLayer';
import { locationApi } from '../api/locationApi';
import { DEFAULT_HOME_RADIUS } from '../constants/network';
import { WigleHeaderActions } from './wigle/WigleHeaderActions';
import { useWigleOverlayManager } from './wigle/useWigleOverlayManager';

const WiglePage: React.FC = () => {
  usePageFilters('wigle');

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const mapboxRef = useRef<typeof mapboxglType | null>(null);
  const clusterColorCache = useRef<Record<string, Record<number, string>>>({ v2: {}, v3: {} });
  const v2FCRef = useRef<any>(null);
  const v3FCRef = useRef<any>(null);
  const kmlFCRef = useRef<any>(null);
  const autoFetchedRef = useRef<{ v2: boolean; v3: boolean }>({ v2: false, v3: false });
  const styleEffectInitRef = useRef(false);
  const [limit] = useState<number | null>(DEFAULT_LIMIT);
  const [mapReady, setMapReady] = useState(false);
  const [, setTokenStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [, setMapSize] = useState({ width: 0, height: 0 });
  const [, setTilesReady] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [pointSize, setPointSize] = useState(5);

  const capabilities = useMemo(() => getPageCapabilities('wigle'), []);
  const adaptedFilters = useAdaptedFilters(capabilities);
  useFilterURLSync();

  const { layers, toggleLayer } = useWigleLayers();
  const layersRef = useRef(layers);
  layersRef.current = layers;

  const [mapError, setError] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [homeLocation, setHomeLocation] = useState<{ center: [number, number]; radius: number }>({
    center: [-98.5795, 39.8283],
    radius: DEFAULT_HOME_RADIUS,
  });

  useEffect(() => {
    locationApi
      .getHomeLocation()
      .then((data) => {
        if (data?.latitude && data?.longitude) {
          setHomeLocation({
            center: [data.longitude, data.latitude],
            radius: data.radius || DEFAULT_HOME_RADIUS,
          });
        }
      })
      .catch(() => {});
  }, []);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 960 : false
  );
  const [mapStyle, setMapStyleState] = useState(
    () => localStorage.getItem('wigle_map_style') || 'mapbox://styles/mapbox/dark-v11'
  );
  const [show3dBuildings, setShow3dBuildingsState] = useState(
    () => localStorage.getItem('wigle_3d_buildings') === 'true'
  );
  const [showTerrain, setShowTerrainState] = useState(
    () => localStorage.getItem('wigle_terrain') === 'true'
  );
  const wigleHandlersAttachedRef = useRef(false);
  const [clusteringEnabled, setClusteringEnabled] = useState(true);
  const showFieldDataRef = useRef(layers.showFieldData);
  showFieldDataRef.current = layers.showFieldData;
  const clusteringEnabledRef = useRef(true);
  clusteringEnabledRef.current = clusteringEnabled;
  const clusteringChangedRef = useRef(false);
  const fieldDataFCRef = useRef<any>(null);

  const {
    v2Loading,
    v3Loading,
    error: dataError,
    v2Rows,
    v3Rows,
    v2Total,
    v3Total,
    fetchPoints,
  } = useWigleData({
    limit,
    offset: 0,
    typeFilter: '',
    adaptedFilters,
    v2Enabled: layers.v2,
    v3Enabled: layers.v3,
  });
  const {
    loading: kmlLoading,
    rows: kmlRows,
    total: kmlTotal,
    error: kmlError,
    fetchPoints: fetchKmlPoints,
  } = useWigleKmlData({ limit, offset: 0, adaptedFilters, enabled: layers.kml });

  const agencyVisibility = useMemo<AgencyVisibility>(
    () => ({ fieldOffices: layers.fieldOffices, residentAgencies: layers.residentAgencies }),
    [layers.fieldOffices, layers.residentAgencies]
  );
  const { data: agencyData } = useAgencyOffices(
    mapRef,
    mapReady,
    agencyVisibility,
    mapboxRef,
    clusteringEnabled
  );
  const { data: courthouseData } = useFederalCourthouses(
    mapRef,
    mapReady,
    layers.federalCourthouses,
    mapboxRef,
    clusteringEnabled
  );
  const { data: deflockData } = useDeflockCameras(
    mapRef,
    mapReady,
    layers.deflockCameras,
    mapboxRef,
    clusteringEnabled
  );
  const { data: shotspotterData } = useShotspotterZones(
    mapRef,
    mapReady,
    layers.shotspotterZones,
    mapboxRef,
    clusteringEnabled
  );
  const { data: shotspotterSensorsData } = useShotspotterSensors(
    mapRef,
    mapReady,
    layers.shotspotterSensors,
    mapboxRef
  );

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

  const v2FeatureCollection = useMemo(() => rowsToGeoJSON(v2Rows), [v2Rows]);
  const v3FeatureCollection = useMemo(() => rowsToGeoJSON(v3Rows), [v3Rows]);
  const kmlFeatureCollection = useMemo(() => kmlRowsToGeoJSON(kmlRows), [kmlRows]);

  v2FCRef.current = v2FeatureCollection;
  v3FCRef.current = v3FeatureCollection;
  kmlFCRef.current = kmlFeatureCollection;

  const {
    ensureAllLayers,
    ensureV2LayersCallback,
    ensureV3LayersCallback,
    ensureKmlLayersCallback,
    applyLayerVisibilityCallback,
    attachClickHandlersCallback,
    updateAllClusterColorsCallback,
    applyEnabledWigleOverlays,
  } = useWigleOverlayManager({
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
  });

  useWigleMapInit({
    mapContainerRef,
    mapRef,
    mapboxRef,
    v2FCRef,
    v3FCRef,
    mapStyle,
    homeLocation,
    setMapSize,
    setTokenStatus,
    setError,
    setMapReady,
    setTilesReady,
    ensureAllLayers,
    attachClickHandlersCallback,
    updateAllClusterColorsCallback,
  });
  useHomeLocationLayer({ mapReady, mapRef, homeLocation, visible: layers.homeArea });
  const {
    loading: fieldDataLoading,
    error: fieldDataError,
    featureCount: fieldDataFeatureCount,
    fetchFieldData,
  } = useWigleFieldData({
    mapRef,
    mapReady,
    mapboxRef,
    showFieldData: layers.showFieldData,
    clusteringEnabled,
    fieldDataFCRef,
  });
  useWigleClusterLayers({
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
    federalCourthousesVisible: layers.federalCourthouses,
    applyLayerVisibilityCallback,
    updateAllClusterColorsCallback,
  });

  useWigleDataSync({
    mapRef,
    mapboxRef,
    v2FeatureCollection,
    v3FeatureCollection,
    kmlFeatureCollection,
    v2FCRef,
    v3FCRef,
    kmlFCRef,
    v2Rows,
    v3Rows,
    kmlRows,
    clusterColorCache,
    ensureV2LayersCallback,
    ensureV3LayersCallback,
    ensureKmlLayersCallback,
    applyLayerVisibilityCallback,
    layers,
  });
  useWigleAutoFetch({
    mapReady,
    layers,
    v2Rows,
    v3Rows,
    kmlRows,
    v2Loading,
    v3Loading,
    kmlLoading,
    adaptedFilters,
    fetchPoints,
    fetchKmlPoints,
    autoFetchedRef,
  });
  useWigleMapFeatures({
    mapRef,
    mapReady,
    mapStyle,
    show3dBuildings,
    showTerrain,
    pointSize,
    v2FCRef,
    v3FCRef,
    kmlFCRef,
    fieldDataFCRef,
    showFieldDataRef,
    styleEffectInitRef,
    wigleHandlersAttachedRef,
    applyEnabledWigleOverlays,
  });
  useWigleResize({ mapContainerRef, mapRef, setMapSize, setIsMobile });

  return (
    <div
      className="min-h-screen w-full text-slate-100 flex flex-col relative"
      style={{ paddingTop: '48px' }}
    >
      <AppHeader
        pageLabel="WiGLE"
        afterLabel={
          <WigleHeaderActions
            showMenu={showMenu}
            setShowMenu={setShowMenu}
            showFilters={showFilters}
            setShowFilters={setShowFilters}
            v2Rows={v2Rows}
            v3Rows={v3Rows}
            mapRef={mapRef}
            mapboxRef={mapboxRef}
            homeLocation={homeLocation}
          />
        }
      />
      <WigleControlPanel
        isOpen={showMenu}
        className={
          isMobile ? '!left-3 !right-3 !w-auto !max-h-[calc(100vh-92px)] !rounded-2xl !p-4' : ''
        }
        pointSize={pointSize}
        onPointSizeChange={setPointSize}
        mapStyle={mapStyle}
        onMapStyleChange={setMapStyle}
        mapStyles={MAP_STYLES}
        show3dBuildings={show3dBuildings}
        onToggle3dBuildings={() => setShow3dBuildings(!show3dBuildings)}
        showTerrain={showTerrain}
        onToggleTerrain={() => setShowTerrain(!showTerrain)}
        clusteringEnabled={clusteringEnabled}
        onToggleClustering={() => setClusteringEnabled((v) => !v)}
        onLoadPoints={() => {
          void (async () => {
            const tasks: Promise<unknown>[] = [];
            if (layers.v2 || layers.v3) {
              tasks.push(fetchPoints());
            }
            if (layers.kml) {
              tasks.push(fetchKmlPoints());
            }
            if (layers.showFieldData) {
              tasks.push(fetchFieldData());
            }
            await Promise.all(tasks);
            applyEnabledWigleOverlays('load-points');
          })();
        }}
        loading={v2Loading || v3Loading || kmlLoading || fieldDataLoading}
        canLoadPoints={layers.v2 || layers.v3 || layers.kml || layers.showFieldData}
        rowsLoaded={
          (layers.v2 ? v2Rows.length : 0) +
          (layers.v3 ? v3Rows.length : 0) +
          (layers.kml ? kmlRows.length : 0) +
          (layers.showFieldData ? fieldDataFeatureCount : 0) +
          ((layers.fieldOffices
            ? (agencyData?.features?.filter(
                (f: any) => f.properties?.office_type === 'field_office'
              ).length ?? 0)
            : 0) +
            (layers.residentAgencies
              ? (agencyData?.features?.filter(
                  (f: any) => f.properties?.office_type === 'resident_agency'
                ).length ?? 0)
              : 0)) +
          (layers.federalCourthouses ? (courthouseData?.features?.length ?? 0) : 0) +
          (layers.deflockCameras ? (deflockData?.features?.length ?? 0) : 0) +
          (layers.shotspotterZones ? (shotspotterData?.features?.length ?? 0) : 0) +
          (layers.shotspotterSensors ? (shotspotterSensorsData?.features?.length ?? 0) : 0)
        }
        totalRows={
          (layers.v2 && v2Total !== null) ||
          (layers.v3 && v3Total !== null) ||
          (layers.kml && kmlTotal !== null)
            ? (layers.v2 ? (v2Total ?? 0) : 0) +
              (layers.v3 ? (v3Total ?? 0) : 0) +
              (layers.kml ? (kmlTotal ?? 0) : 0)
            : null
        }
        layers={layers}
        onToggleLayer={toggleLayer}
      />
      <FilterPanelContainer
        isOpen={showFilters}
        adaptedFilters={adaptedFilters}
        position="overlay"
        className={
          isMobile
            ? '!left-3 !right-3 !top-[4.5rem] !w-auto !max-h-[calc(100vh-100px)]'
            : !showMenu
              ? '!left-4'
              : ''
        }
      />
      <WigleMap
        mapContainerRef={mapContainerRef}
        error={mapError || dataError || kmlError || fieldDataError}
        mapReady={mapReady}
        mapRef={mapRef}
        homeLocation={homeLocation}
        v2Rows={v2Rows}
        v3Rows={v3Rows}
      />
    </div>
  );
};
export default WiglePage;
