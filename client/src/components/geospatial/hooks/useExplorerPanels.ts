import { useMemo, useState } from 'react';
import {
  GEOSPATIAL_LAYER_COLORS,
  GEOSPATIAL_LAYER_LABELS,
  type GeospatialLayerOption,
} from '../layers/layerCatalog';
import { useGeospatialLayerPreferences } from './useGeospatialLayerPreferences';

export const useExplorerPanels = () => {
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { visibility, opacity, order, toggleLayer, setLayerOpacity, moveLayer } =
    useGeospatialLayerPreferences();

  const showCourthousesPanel = visibility.courthouses;
  const showAlprCameras = visibility.alpr;
  const showFieldOffices = visibility.fieldOffices;
  const showResidentAgencies = visibility.residentAgencies;

  const toggleFilters = () => setFiltersOpen((open) => !open);
  const toggleColumnSelector = () => setShowColumnSelector((open) => !open);
  const toggleCourthousesPanel = () => toggleLayer('courthouses');
  const toggleAlprCameras = () => toggleLayer('alpr');
  const toggleFieldOffices = () => toggleLayer('fieldOffices');
  const toggleResidentAgencies = () => toggleLayer('residentAgencies');

  const mapLayerOptions = useMemo<GeospatialLayerOption[]>(
    () =>
      order.map((key) => ({
        key,
        label: GEOSPATIAL_LAYER_LABELS[key],
        color: GEOSPATIAL_LAYER_COLORS[key],
        visible: visibility[key],
        opacity: opacity[key],
        onToggle: () => toggleLayer(key),
        onOpacityChange: (value) => setLayerOpacity(key, value),
        onMoveUp: () => moveLayer(key, 1),
        onMoveDown: () => moveLayer(key, -1),
      })),
    [moveLayer, opacity, order, setLayerOpacity, toggleLayer, visibility]
  );

  return {
    filtersOpen,
    showColumnSelector,
    showCourthousesPanel,
    showAlprCameras,
    showHome: visibility.home,
    showWigleV2: visibility.wigleV2,
    showWigleV3: visibility.wigleV3,
    showWigleKml: visibility.wigleKml,
    showFieldObservations: visibility.fieldObservations,
    showFieldOffices,
    showResidentAgencies,
    showShotspotterZones: visibility.shotspotterZones,
    showShotspotterSensors: visibility.shotspotterSensors,
    mapLayerOptions,
    mapLayerOpacity: opacity,
    mapLayerOrder: order,
    toggleFilters,
    toggleColumnSelector,
    toggleCourthousesPanel,
    toggleAlprCameras,
    toggleHome: () => toggleLayer('home'),
    toggleWigleV2: () => toggleLayer('wigleV2'),
    toggleWigleV3: () => toggleLayer('wigleV3'),
    toggleWigleKml: () => toggleLayer('wigleKml'),
    toggleFieldObservations: () => toggleLayer('fieldObservations'),
    toggleFieldOffices,
    toggleResidentAgencies,
    toggleShotspotterZones: () => toggleLayer('shotspotterZones'),
    toggleShotspotterSensors: () => toggleLayer('shotspotterSensors'),
  };
};
