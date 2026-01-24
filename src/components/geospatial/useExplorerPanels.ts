import { useState } from 'react';

export const useExplorerPanels = () => {
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const toggleFilters = () => setFiltersOpen((open) => !open);
  const toggleColumnSelector = () => setShowColumnSelector((open) => !open);

  return {
    filtersOpen,
    showColumnSelector,
    toggleFilters,
    toggleColumnSelector,
  };
};
