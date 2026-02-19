/**
 * Threat Analysis Filters Section
 */

import React from 'react';
import { FilterSection, FilterInput } from '../../filter';
import { NetworkFilters, ThreatCategory } from '../../../types/filters';

interface ThreatFiltersProps {
  filters: NetworkFilters;
  enabled: Record<keyof NetworkFilters, boolean>;
  isCompact: boolean;
  controlClass: string;
  listLayoutClass: string;
  listItemTextClass: string;
  onSetFilter: <K extends keyof NetworkFilters>(key: K, value: NetworkFilters[K]) => void;
  onToggleFilter: (key: keyof NetworkFilters) => void;
}

export const ThreatFilters: React.FC<ThreatFiltersProps> = ({
  filters,
  enabled,
  isCompact,
  controlClass,
  listLayoutClass,
  listItemTextClass,
  onSetFilter,
  onToggleFilter,
}) => {
  return (
    <FilterSection title="Threat Analysis" compact={isCompact}>
      <FilterInput
        label="Threat Score Min"
        enabled={enabled.threatScoreMin || false}
        onToggle={() => onToggleFilter('threatScoreMin')}
        compact={isCompact}
      >
        <input
          type="number"
          value={filters.threatScoreMin ?? ''}
          onChange={(e) => onSetFilter('threatScoreMin', parseFloat(e.target.value))}
          placeholder="0.0"
          step="0.1"
          min="0"
          max="1"
          className={controlClass}
        />
      </FilterInput>

      <FilterInput
        label="Threat Score Max"
        enabled={enabled.threatScoreMax || false}
        onToggle={() => onToggleFilter('threatScoreMax')}
        compact={isCompact}
      >
        <input
          type="number"
          value={filters.threatScoreMax ?? ''}
          onChange={(e) => onSetFilter('threatScoreMax', parseFloat(e.target.value))}
          placeholder="1.0"
          step="0.1"
          min="0"
          max="1"
          className={controlClass}
        />
      </FilterInput>

      <FilterInput
        label="Threat Categories"
        enabled={enabled.threatCategories || false}
        onToggle={() => onToggleFilter('threatCategories')}
        compact={isCompact}
      >
        <div className={listLayoutClass}>
          {(
            [
              'surveillance',
              'tracking',
              'rogue_ap',
              'evil_twin',
              'deauth',
              'spoofing',
              'unknown',
            ] as ThreatCategory[]
          ).map((cat) => (
            <label key={cat} className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={filters.threatCategories?.includes(cat) || false}
                onChange={(e) => {
                  const current = filters.threatCategories || [];
                  const updated = e.target.checked
                    ? [...current, cat]
                    : current.filter((c: string) => c !== cat);
                  onSetFilter('threatCategories', updated);
                }}
                className="filter-panel__checkbox rounded border-slate-600 bg-slate-800 text-blue-500"
              />
              <span className={`${listItemTextClass} text-slate-300 capitalize`}>
                {cat.replace('_', ' ')}
              </span>
            </label>
          ))}
        </div>
      </FilterInput>

      <FilterInput
        label="Stationary Confidence Min"
        enabled={enabled.stationaryConfidenceMin || false}
        onToggle={() => onToggleFilter('stationaryConfidenceMin')}
        compact={isCompact}
      >
        <input
          type="number"
          value={filters.stationaryConfidenceMin ?? ''}
          onChange={(e) => onSetFilter('stationaryConfidenceMin', parseFloat(e.target.value))}
          placeholder="0.0"
          step="0.1"
          min="0"
          max="1"
          className={controlClass}
        />
      </FilterInput>

      <FilterInput
        label="Stationary Confidence Max"
        enabled={enabled.stationaryConfidenceMax || false}
        onToggle={() => onToggleFilter('stationaryConfidenceMax')}
        compact={isCompact}
      >
        <input
          type="number"
          value={filters.stationaryConfidenceMax ?? ''}
          onChange={(e) => onSetFilter('stationaryConfidenceMax', parseFloat(e.target.value))}
          placeholder="1.0"
          step="0.1"
          min="0"
          max="1"
          className={controlClass}
        />
      </FilterInput>
    </FilterSection>
  );
};
