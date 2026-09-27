import { useState } from 'react';

export const useExplorerPanels = () => {
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [showAgenciesPanel, setShowAgenciesPanel] = useState(false);
  const [showCourthousesPanel, setShowCourthousesPanel] = useState(false);
  const [showAlprCameras, setShowAlprCameras] = useState(false);

  const toggleFilters = () => setFiltersOpen((open) => !open);
  const toggleColumnSelector = () => setShowColumnSelector((open) => !open);
  const toggleAgenciesPanel = () => setShowAgenciesPanel((open) => !open);
  const toggleCourthousesPanel = () => setShowCourthousesPanel((open) => !open);
  const toggleAlprCameras = () => setShowAlprCameras((open) => !open);

  return {
    filtersOpen,
    showColumnSelector,
    showAgenciesPanel,
    showCourthousesPanel,
    showAlprCameras,
    toggleFilters,
    toggleColumnSelector,
    toggleAgenciesPanel,
    toggleCourthousesPanel,
    toggleAlprCameras,
  };
};
