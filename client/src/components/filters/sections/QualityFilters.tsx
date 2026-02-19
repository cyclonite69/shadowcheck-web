/**
 * Data Quality Filters Section
 */

import React from 'react';
import { FilterSection, FilterInput } from '../../filter';
import { NetworkFilters } from '../../../types/filters';

interface QualityFiltersProps {
  filters: NetworkFilters;
  enabled: Record<keyof NetworkFilters, boolean>;
  isCompact: boolean;
  controlClass: string;
  onSetFilter: <K extends keyof NetworkFilters>(key: K, value: NetworkFilters[K]) => void;
  onToggleFilter: (key: keyof NetworkFilters) => void;
}

export const QualityFilters: React.FC<QualityFiltersProps> = ({
  filters,
  enabled,
  isCompact,
  controlClass,
  onSetFilter,
  onToggleFilter,
}) => {
  return (
    <FilterSection title="Data Quality" compact={isCompact}>
      <FilterInput
        label="Min Observations"
        enabled={enabled.observationCountMin || false}
        onToggle={() => onToggleFilter('observationCountMin')}
        compact={isCompact}
      >
        <input
          type="number"
          value={filters.observationCountMin ?? ''}
          onChange={(e) => onSetFilter('observationCountMin', parseInt(e.target.value, 10))}
          placeholder="1"
          min="1"
          className={controlClass}
        />
      </FilterInput>

      <FilterInput
        label="Max Observations"
        enabled={enabled.observationCountMax || false}
        onToggle={() => onToggleFilter('observationCountMax')}
        compact={isCompact}
      >
        <input
          type="number"
          value={filters.observationCountMax ?? ''}
          onChange={(e) => onSetFilter('observationCountMax', parseInt(e.target.value, 10))}
          placeholder="1000"
          min="1"
          className={controlClass}
        />
      </FilterInput>

      <FilterInput
        label="GPS Accuracy Max (m)"
        enabled={enabled.gpsAccuracyMax || false}
        onToggle={() => onToggleFilter('gpsAccuracyMax')}
        compact={isCompact}
      >
        <input
          type="number"
          value={filters.gpsAccuracyMax ?? ''}
          onChange={(e) => onSetFilter('gpsAccuracyMax', parseInt(e.target.value, 10))}
          placeholder="100"
          min="1"
          max="10000"
          className={controlClass}
        />
      </FilterInput>

      <FilterInput
        label="Exclude Invalid Coords"
        enabled={enabled.excludeInvalidCoords || false}
        onToggle={() => onToggleFilter('excludeInvalidCoords')}
        compact={isCompact}
      >
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={filters.excludeInvalidCoords || false}
            onChange={(e) => onSetFilter('excludeInvalidCoords', e.target.checked)}
            className="w-4 h-4"
          />
          <span className="text-xs text-slate-400">Filter out (0,0) and invalid GPS</span>
        </div>
      </FilterInput>

      <FilterInput
        label="Quality Preset"
        enabled={enabled.qualityFilter || false}
        onToggle={() => onToggleFilter('qualityFilter')}
        compact={isCompact}
      >
        <select
          value={filters.qualityFilter || 'none'}
          onChange={(e) => onSetFilter('qualityFilter', e.target.value as any)}
          className={controlClass}
        >
          <option value="none">None</option>
          <option value="temporal">Temporal (single-day)</option>
          <option value="extreme">Extreme (outliers)</option>
          <option value="duplicate">Duplicates</option>
          <option value="all">All Quality Checks</option>
        </select>
      </FilterInput>
    </FilterSection>
  );
};
