/**
 * Radio & Physical Filters Section
 */

import React from 'react';
import { FilterSection, FilterInput } from '../../filter';
import { RadioType, FrequencyBand, NetworkFilters } from '../../../types/filters';

interface RadioFiltersProps {
  filters: NetworkFilters;
  enabled: Record<keyof NetworkFilters, boolean>;
  isCompact: boolean;
  controlClass: string;
  listLayoutClass: string;
  listItemTextClass: string;
  onSetFilter: <K extends keyof NetworkFilters>(key: K, value: NetworkFilters[K]) => void;
  onToggleFilter: (key: keyof NetworkFilters) => void;
}

export const RadioFilters: React.FC<RadioFiltersProps> = ({
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
    <FilterSection title="Radio & Physical" compact={isCompact}>
      <FilterInput
        label="Radio Types"
        enabled={enabled.radioTypes || false}
        onToggle={() => onToggleFilter('radioTypes')}
        compact={isCompact}
      >
        <div className={listLayoutClass}>
          {(['W', 'E', 'B', 'L', 'G', 'N', '?'] as RadioType[]).map((type) => (
            <label key={type} className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={filters.radioTypes?.includes(type) || false}
                onChange={(e) => {
                  const current = filters.radioTypes || [];
                  const updated = e.target.checked
                    ? [...current, type]
                    : current.filter((t: string) => t !== type);
                  onSetFilter('radioTypes', updated);
                }}
                className="filter-panel__checkbox rounded border-slate-600 bg-slate-800 text-blue-500"
              />
              <span className={`${listItemTextClass} text-slate-300`}>
                {type === 'W'
                  ? 'WiFi'
                  : type === 'E'
                    ? 'BLE'
                    : type === 'B'
                      ? 'Bluetooth'
                      : type === 'L'
                        ? 'LTE'
                        : type === 'G'
                          ? 'GSM'
                          : type === 'N'
                            ? '5G NR'
                            : 'Unknown'}
              </span>
            </label>
          ))}
        </div>
      </FilterInput>

      <FilterInput
        label="Frequency Band"
        enabled={enabled.frequencyBands || false}
        onToggle={() => onToggleFilter('frequencyBands')}
        compact={isCompact}
      >
        <div className={listLayoutClass}>
          {(['2.4GHz', '5GHz', '6GHz', 'BLE', 'Cellular'] as FrequencyBand[]).map((band) => (
            <label key={band} className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={filters.frequencyBands?.includes(band) || false}
                onChange={(e) => {
                  const current = filters.frequencyBands || [];
                  const updated = e.target.checked
                    ? [...current, band]
                    : current.filter((b: string) => b !== band);
                  onSetFilter('frequencyBands', updated);
                }}
                className="filter-panel__checkbox rounded border-slate-600 bg-slate-800 text-blue-500"
              />
              <span className={`${listItemTextClass} text-slate-300`}>{band}</span>
            </label>
          ))}
        </div>
      </FilterInput>

      <FilterInput
        label="Channel Min"
        enabled={enabled.channelMin || false}
        onToggle={() => onToggleFilter('channelMin')}
        compact={isCompact}
      >
        <input
          type="number"
          value={filters.channelMin ?? ''}
          onChange={(e) => onSetFilter('channelMin', parseInt(e.target.value, 10))}
          placeholder="e.g. 1"
          className={controlClass}
        />
      </FilterInput>

      <FilterInput
        label="Channel Max"
        enabled={enabled.channelMax || false}
        onToggle={() => onToggleFilter('channelMax')}
        compact={isCompact}
      >
        <input
          type="number"
          value={filters.channelMax ?? ''}
          onChange={(e) => onSetFilter('channelMax', parseInt(e.target.value, 10))}
          placeholder="e.g. 165"
          className={controlClass}
        />
      </FilterInput>

      <FilterInput
        label="RSSI Min (dBm)"
        enabled={enabled.rssiMin || false}
        onToggle={() => onToggleFilter('rssiMin')}
        compact={isCompact}
      >
        <input
          type="number"
          value={filters.rssiMin ?? ''}
          onChange={(e) => onSetFilter('rssiMin', parseInt(e.target.value, 10))}
          placeholder="-95"
          className={controlClass}
        />
        <p className="mt-1 text-xs text-slate-500">Noise floor enforced at -95 dBm.</p>
      </FilterInput>

      <FilterInput
        label="RSSI Max (dBm)"
        enabled={enabled.rssiMax || false}
        onToggle={() => onToggleFilter('rssiMax')}
        compact={isCompact}
      >
        <input
          type="number"
          value={filters.rssiMax ?? ''}
          onChange={(e) => onSetFilter('rssiMax', parseInt(e.target.value, 10))}
          placeholder="-30"
          className={controlClass}
        />
      </FilterInput>
    </FilterSection>
  );
};
