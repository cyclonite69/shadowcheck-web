/**
 * Notes, Tags, and WiGLE Filters Section
 */

import React from 'react';
import { FilterSection, FilterInput } from '../../filter';
import { NetworkFilters, TagType } from '../../../types/filters';

interface EngagementFiltersProps {
  filters: NetworkFilters;
  enabled: Record<keyof NetworkFilters, boolean>;
  isCompact: boolean;
  controlClass: string;
  onSetFilter: <K extends keyof NetworkFilters>(key: K, value: NetworkFilters[K]) => void;
  onToggleFilter: (key: keyof NetworkFilters) => void;
}

export const EngagementFilters: React.FC<EngagementFiltersProps> = ({
  filters,
  enabled,
  isCompact,
  controlClass,
  onSetFilter,
  onToggleFilter,
}) => {
  return (
    <FilterSection title="Notes & WiGLE" compact={isCompact}>
      <FilterInput
        label="Has Notes"
        enabled={enabled.has_notes || false}
        onToggle={() => onToggleFilter('has_notes')}
        compact={isCompact}
      >
        <label className="flex items-center gap-2 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={filters.has_notes ?? false}
            onChange={(e) => onSetFilter('has_notes', e.target.checked)}
            className="w-4 h-4"
          />
          Only networks with notes
        </label>
      </FilterInput>

      <FilterInput
        label="Tag Type"
        enabled={enabled.tag_type || false}
        onToggle={() => onToggleFilter('tag_type')}
        compact={isCompact}
      >
        <select
          multiple
          value={filters.tag_type ?? []}
          onChange={(e) =>
            onSetFilter(
              'tag_type',
              Array.from(e.target.selectedOptions).map((opt) => opt.value) as TagType[]
            )
          }
          className={controlClass}
        >
          <option value="threat">Threat</option>
          <option value="investigate">Investigate</option>
          <option value="false_positive">False Positive</option>
          <option value="ignore">Ignore (Known/Friendly)</option>
        </select>
      </FilterInput>

      <FilterInput
        label="Min WiGLE Observations"
        enabled={enabled.wigle_v3_observation_count_min || false}
        onToggle={() => onToggleFilter('wigle_v3_observation_count_min')}
        compact={isCompact}
      >
        <input
          type="number"
          min="0"
          value={filters.wigle_v3_observation_count_min ?? ''}
          onChange={(e) =>
            onSetFilter(
              'wigle_v3_observation_count_min',
              e.target.value ? parseInt(e.target.value, 10) : undefined
            )
          }
          placeholder="e.g., 10"
          className={controlClass}
        />
      </FilterInput>
    </FilterSection>
  );
};
