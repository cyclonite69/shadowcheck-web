import React from 'react';
import { FilterPanelContainer } from '../FilterPanelContainer';

interface KeplerFiltersProps {
  showFilters: boolean;
  className?: string;
}

export const KeplerFilters: React.FC<KeplerFiltersProps> = ({ showFilters, className }) => {
  return <FilterPanelContainer isOpen={showFilters} position="overlay" className={className} />;
};
