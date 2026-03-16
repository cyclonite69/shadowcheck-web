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
  showBoundingBoxViewportLock?: boolean;
  boundingBoxViewportLock?: boolean;
  onSetFilter: <K extends keyof NetworkFilters>(key: K, value: NetworkFilters[K]) => void;
  onSetBoundingBoxViewportLock?: (locked: boolean) => void;
  onToggleFilter: (key: keyof NetworkFilters) => void;
}

export const SpatialFilters: React.FC<SpatialFiltersProps> = ({
  filters,
  enabled,
  isCompact,
  controlClass,
  showBoundingBoxViewportLock = false,
  boundingBoxViewportLock = false,
  onSetFilter,
  onSetBoundingBoxViewportLock,
  onToggleFilter,
}) => {
  const updateBoundingBox = (
    key: 'north' | 'south' | 'east' | 'west',
    value: number | undefined
  ) => {
    const current = filters.boundingBox || { north: 0, south: 0, east: 0, west: 0 };
    onSetFilter('boundingBox', {
      ...current,
      [key]: value ?? 0,
    });
  };

  const updateRadiusFilter = (
    key: 'latitude' | 'longitude' | 'radiusMeters',
    value: number | undefined
  ) => {
    const current = filters.radiusFilter || { latitude: 0, longitude: 0, radiusMeters: 0 };
    onSetFilter('radiusFilter', {
      ...current,
      [key]: value ?? 0,
    });
  };

  const parseNumericInput = (value: string) => {
    if (value.trim() === '') return undefined;
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

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

      <FilterInput
        label="Bounding Box"
        enabled={enabled.boundingBox || false}
        onToggle={() => onToggleFilter('boundingBox')}
        compact={isCompact}
      >
        <div className="space-y-2">
          {showBoundingBoxViewportLock && onSetBoundingBoxViewportLock && (
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={boundingBoxViewportLock}
                onChange={(e) => onSetBoundingBoxViewportLock(e.target.checked)}
                className="rounded border-slate-500 bg-slate-800 text-blue-500 focus:ring-blue-500"
              />
              Lock to current map viewport
            </label>
          )}
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              value={filters.boundingBox?.north ?? ''}
              onChange={(e) => updateBoundingBox('north', parseNumericInput(e.target.value))}
              placeholder="North"
              step="0.0001"
              className={controlClass}
            />
            <input
              type="number"
              value={filters.boundingBox?.south ?? ''}
              onChange={(e) => updateBoundingBox('south', parseNumericInput(e.target.value))}
              placeholder="South"
              step="0.0001"
              className={controlClass}
            />
            <input
              type="number"
              value={filters.boundingBox?.east ?? ''}
              onChange={(e) => updateBoundingBox('east', parseNumericInput(e.target.value))}
              placeholder="East"
              step="0.0001"
              className={controlClass}
            />
            <input
              type="number"
              value={filters.boundingBox?.west ?? ''}
              onChange={(e) => updateBoundingBox('west', parseNumericInput(e.target.value))}
              placeholder="West"
              step="0.0001"
              className={controlClass}
            />
          </div>
          {showBoundingBoxViewportLock && (
            <p className="text-[11px] text-slate-500">
              When locked, the bounding box follows map pan and zoom. Turn it off to keep the
              current box fixed.
            </p>
          )}
        </div>
      </FilterInput>

      <FilterInput
        label="Radius Filter"
        enabled={enabled.radiusFilter || false}
        onToggle={() => onToggleFilter('radiusFilter')}
        compact={isCompact}
      >
        <div className="grid grid-cols-1 gap-2">
          <input
            type="number"
            value={filters.radiusFilter?.latitude ?? ''}
            onChange={(e) => updateRadiusFilter('latitude', parseNumericInput(e.target.value))}
            placeholder="Center latitude"
            step="0.0001"
            className={controlClass}
          />
          <input
            type="number"
            value={filters.radiusFilter?.longitude ?? ''}
            onChange={(e) => updateRadiusFilter('longitude', parseNumericInput(e.target.value))}
            placeholder="Center longitude"
            step="0.0001"
            className={controlClass}
          />
          <input
            type="number"
            value={filters.radiusFilter?.radiusMeters ?? ''}
            onChange={(e) => updateRadiusFilter('radiusMeters', parseNumericInput(e.target.value))}
            placeholder="Radius meters"
            step="1"
            min="0"
            className={controlClass}
          />
        </div>
      </FilterInput>
    </FilterSection>
  );
};
