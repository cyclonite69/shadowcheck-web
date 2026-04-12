/**
 * Identity Filters Section
 * SSID, BSSID, Manufacturer filters
 */

import React from 'react';
import { FilterSection, FilterInput } from '../../filter';
import { NetworkFilters } from '../../../types/filters';

interface IdentityFiltersProps {
  filters: NetworkFilters;
  enabled: Record<keyof NetworkFilters, boolean>;
  isCompact: boolean;
  controlClass: string;
  onSetFilter: <K extends keyof NetworkFilters>(key: K, value: NetworkFilters[K]) => void;
  onToggleFilter: (key: keyof NetworkFilters) => void;
}

export const IdentityFilters: React.FC<IdentityFiltersProps> = ({
  filters,
  enabled,
  isCompact,
  controlClass,
  onSetFilter,
  onToggleFilter,
}) => {
  return (
    <FilterSection title="Identity" compact={isCompact}>
      <FilterInput
        label="SSID"
        enabled={enabled.ssid || false}
        onToggle={() => onToggleFilter('ssid')}
        compact={isCompact}
      >
        <input
          type="text"
          value={filters.ssid || ''}
          onChange={(e) => onSetFilter('ssid', e.target.value)}
          placeholder="Network name or comma list..."
          className={`${controlClass} focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
        />
        <p className="mt-1 text-xs text-slate-500">
          Use commas for OR. Prefix with <b>-</b> or <b>NOT</b> to exclude.
        </p>
      </FilterInput>

      <FilterInput
        label="BSSID"
        enabled={enabled.bssid || false}
        onToggle={() => onToggleFilter('bssid')}
        compact={isCompact}
      >
        <input
          type="text"
          value={filters.bssid || ''}
          onChange={(e) => onSetFilter('bssid', e.target.value)}
          placeholder="AA:BB:CC:DD:EE:FF, AA:BB:CC..."
          className={`${controlClass} focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
        />
        <p className="mt-1 text-xs text-slate-500">
          Supports <b>*</b> and <b>?</b> wildcards. Prefix with <b>-</b> to exclude.
        </p>
      </FilterInput>

      <FilterInput
        label="Manufacturer / OUI"
        enabled={enabled.manufacturer || false}
        onToggle={() => onToggleFilter('manufacturer')}
        compact={isCompact}
      >
        <input
          type="text"
          value={filters.manufacturer || ''}
          onChange={(e) => onSetFilter('manufacturer', e.target.value)}
          placeholder="Apple, Samsung, 001A2B..."
          className={`${controlClass} focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
        />
        <p className="mt-1 text-xs text-slate-500">
          Use commas to match multiple manufacturers or OUI prefixes.
        </p>
      </FilterInput>
    </FilterSection>
  );
};
