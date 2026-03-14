import React from 'react';
import { FilterPanelContainer } from '../FilterPanelContainer';

interface KeplerFiltersProps {
  showFilters: boolean;
}

export const KeplerFilters: React.FC<KeplerFiltersProps> = ({ showFilters }) => {
  return <FilterPanelContainer isOpen={showFilters} position="overlay" />;
};
