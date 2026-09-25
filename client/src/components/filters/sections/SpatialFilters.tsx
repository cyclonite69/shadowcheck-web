/**
 * Spatial & Proximity Filters Section
 */

import React from 'react';
import { FilterSection, FilterInput } from '../../filter';
import { NetworkFilters } from '../../../types/filters';
import { usePinDropStore } from '../../../stores/pinDropStore';

const CrosshairIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width={14}
    height={14}
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="3" />
    <line x1="12" y1="2" x2="12" y2="6" />
    <line x1="12" y1="18" x2="12" y2="22" />
    <line x1="2" y1="12" x2="6" y2="12" />
    <line x1="18" y1="12" x2="22" y2="12" />
  </svg>
);

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
  const pinDropActive = usePinDropStore((s) => s.active);
  const startPinDrop = usePinDropStore((s) => s.start);
  const cancelPinDrop = usePinDropStore((s) => s.cancel);
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
    if (value.trim() === '') {
      return undefined;
    }
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
        labelExtra={
          <button
            type="button"
            onClick={() => (pinDropActive ? cancelPinDrop() : startPinDrop())}
            title={pinDropActive ? 'Cancel pin-drop (Esc)' : 'Click map to set center'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '2px 5px',
              borderRadius: '4px',
              border: `1px solid ${pinDropActive ? '#06b6d4' : '#475569'}`,
              background: pinDropActive ? 'rgba(6,182,212,0.15)' : 'transparent',
              color: pinDropActive ? '#06b6d4' : '#94a3b8',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            aria-pressed={pinDropActive}
          >
            <CrosshairIcon />
          </button>
        }
      >
        {pinDropActive && (
          <div
            style={{
              fontSize: '11px',
              color: '#06b6d4',
              background: 'rgba(6,182,212,0.08)',
              border: '1px solid rgba(6,182,212,0.25)',
              borderRadius: '4px',
              padding: '4px 8px',
              marginBottom: '6px',
            }}
          >
            Click map to set center · Esc to cancel
          </div>
        )}
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
