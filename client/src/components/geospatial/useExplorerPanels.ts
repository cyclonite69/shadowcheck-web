import { useState } from 'react';

export const useExplorerPanels = () => {
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [showAgenciesPanel, setShowAgenciesPanel] = useState(false);

  const toggleFilters = () => setFiltersOpen((open) => !open);
  const toggleColumnSelector = () => setShowColumnSelector((open) => !open);
  const toggleAgenciesPanel = () => setShowAgenciesPanel((open) => !open);

  return {
    filtersOpen,
    showColumnSelector,
    showAgenciesPanel,
    toggleFilters,
    toggleColumnSelector,
    toggleAgenciesPanel,
  };
};
