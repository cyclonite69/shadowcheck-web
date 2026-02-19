/**
 * Spatial & Proximity Filters Section
 */

import React from 'react';
import { FilterSection, FilterInput } from '../../filter';
import { NetworkFilters } from '../../../types/filters';

interface SpatialFiltersProps {
  filters: NetworkFilters;
  enabled: Record<keyof NetworkFilters, boolean>;
  isCompact: boolean;
  controlClass: string;
  onSetFilter: <K extends keyof NetworkFilters>(key: K, value: NetworkFilters[K]) => void;
  onToggleFilter: (key: keyof NetworkFilters) => void;
}

export const SpatialFilters: React.FC<SpatialFiltersProps> = ({
  filters,
  enabled,
  isCompact,
  controlClass,
  onSetFilter,
  onToggleFilter,
}) => {
  return (
    <FilterSection title="Spatial & Proximity" compact={isCompact}>
      <FilterInput
        label="Distance from Home Min (km)"
        enabled={enabled.distanceFromHomeMin || false}
        onToggle={() => onToggleFilter('distanceFromHomeMin')}
        compact={isCompact}
      >
        <input
          type="number"
          value={filters.distanceFromHomeMin ?? ''}
          onChange={(e) => onSetFilter('distanceFromHomeMin', parseFloat(e.target.value))}
          placeholder="0"
          step="0.1"
          min="0"
          className={controlClass}
        />
      </FilterInput>

      <FilterInput
        label="Distance from Home Max (km)"
        enabled={enabled.distanceFromHomeMax || false}
        onToggle={() => onToggleFilter('distanceFromHomeMax')}
        compact={isCompact}
      >
        <input
          type="number"
          value={filters.distanceFromHomeMax ?? ''}
          onChange={(e) => onSetFilter('distanceFromHomeMax', parseFloat(e.target.value))}
          placeholder="100"
          step="0.1"
          min="0"
          className={controlClass}
        />
      </FilterInput>
    </FilterSection>
  );
};
