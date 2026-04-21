/**
 * Notes, manual tagging, and WiGLE filters.
 */

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

export const EngagementFilters = ({
  filters,
  enabled,
  isCompact,
  controlClass,
  onSetFilter,
  onToggleFilter,
}: EngagementFiltersProps) => {
  return (
    <FilterSection title="Engagement & WiGLE" compact={isCompact}>
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
        label="Manual Tag"
        enabled={enabled.tag_type || false}
        onToggle={() => onToggleFilter('tag_type')}
        compact={isCompact}
      >
        <div className="space-y-1">
          <p className="text-[11px] text-slate-400">
            Analyst-assigned manual tag from context menu/actions.
          </p>
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
            <option value="threat">Threat (Manual)</option>
            <option value="investigate">Investigate (Manual)</option>
            <option value="false_positive">False Positive (Manual)</option>
            <option value="ignore">Ignore (Known/Friendly)</option>
          </select>
        </div>
      </FilterInput>

      <FilterInput
        label="WiGLE Observations Range"
        enabled={enabled.wigle_v3_observation_count_min || enabled.wigle_v3_observation_count_max}
        onToggle={() => {
          onToggleFilter('wigle_v3_observation_count_min');
          onToggleFilter('wigle_v3_observation_count_max');
        }}
        compact={isCompact}
      >
        <div className="flex items-center gap-2">
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
            placeholder="Min"
            className={controlClass}
          />
          <span className="text-slate-500">to</span>
          <input
            type="number"
            min="0"
            value={filters.wigle_v3_observation_count_max ?? ''}
            onChange={(e) =>
              onSetFilter(
                'wigle_v3_observation_count_max',
                e.target.value ? parseInt(e.target.value, 10) : undefined
              )
            }
            placeholder="Max"
            className={controlClass}
          />
        </div>
      </FilterInput>

      <FilterInput
        label="WiGLE Last Import Range"
        enabled={enabled.wigleV3LastImportAfter || enabled.wigleV3LastImportBefore}
        onToggle={() => {
          onToggleFilter('wigleV3LastImportAfter');
          onToggleFilter('wigleV3LastImportBefore');
        }}
        compact={isCompact}
      >
        <div className="space-y-2">
          <div>
            <label className="text-[10px] text-slate-500 block mb-1">Since</label>
            <input
              type="date"
              value={filters.wigleV3LastImportAfter || ''}
              onChange={(e) => onSetFilter('wigleV3LastImportAfter', e.target.value)}
              className={controlClass}
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-500 block mb-1">Until</label>
            <input
              type="date"
              value={filters.wigleV3LastImportBefore || ''}
              onChange={(e) => onSetFilter('wigleV3LastImportBefore', e.target.value)}
              className={controlClass}
            />
          </div>
        </div>
      </FilterInput>
    </FilterSection>
  );
};
