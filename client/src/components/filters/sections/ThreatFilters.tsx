/**
 * Computed threat severity filters (score/level based).
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
  listLayoutClass,
  listItemTextClass,
  onSetFilter,
  onToggleFilter,
}) => {
  return (
    <FilterSection title="Threat Intelligence" compact={isCompact}>
      {/* 1. Surveillance Umbrella Toggle */}
      <FilterInput
        label="Surveillance"
        enabled={enabled.surveillance || false}
        onToggle={() => onToggleFilter('surveillance')}
        compact={isCompact}
      >
        <div className={listLayoutClass}>
          <div className="space-y-2">
            <p className="text-[11px] text-slate-400">
              Shows networks detected in the surveillance catalog.
            </p>

            {/* Device Type Sub-filters */}
            <div className="space-y-1.5 pt-1 border-t border-slate-700/50">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={filters.flock ?? false}
                  onChange={(e) => onSetFilter('flock', e.target.checked)}
                  className="filter-panel__checkbox rounded border-slate-600 bg-slate-800 text-blue-500"
                />
                <span className={`${listItemTextClass} text-slate-300`}>Flock Safety / ALPR</span>
              </label>

              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={filters.bwc ?? false}
                  onChange={(e) => onSetFilter('bwc', e.target.checked)}
                  className="filter-panel__checkbox rounded border-slate-600 bg-slate-800 text-blue-500"
                />
                <span className={`${listItemTextClass} text-slate-300`}>Body Worn Camera</span>
              </label>

              {filters.bwc && (
                <div className="ml-6 space-y-1.5 border-l border-slate-700/50 pl-3">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={filters.dashcam ?? false}
                      onChange={(e) => onSetFilter('dashcam', e.target.checked)}
                      className="filter-panel__checkbox rounded border-slate-600 bg-slate-800 text-blue-500"
                    />
                    <span className={`${listItemTextClass} text-slate-400`}>Dashcam</span>
                  </label>

                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={filters.residential_cam ?? false}
                      onChange={(e) => onSetFilter('residential_cam', e.target.checked)}
                      className="filter-panel__checkbox rounded border-slate-600 bg-slate-800 text-blue-500"
                    />
                    <span className={`${listItemTextClass} text-slate-400`}>
                      Residential Camera
                    </span>
                  </label>
                </div>
              )}

              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={filters.shotspotter ?? false}
                  onChange={(e) => onSetFilter('shotspotter', e.target.checked)}
                  className="filter-panel__checkbox rounded border-slate-600 bg-slate-800 text-blue-500"
                />
                <span className={`${listItemTextClass} text-slate-300`}>ShotSpotter Sensor</span>
              </label>
            </div>
          </div>
        </div>
      </FilterInput>

      {/* 2. Threat Level (Computed) */}
      <FilterInput
        label="Threat Level"
        enabled={enabled.threatCategories || false}
        onToggle={() => onToggleFilter('threatCategories')}
        compact={isCompact}
      >
        <div className="space-y-2">
          <p className="text-[11px] text-slate-400">
            Uses computed final threat level (CRITICAL/HIGH/MED/LOW/NONE).
          </p>
          <div className={listLayoutClass}>
            {(['critical', 'high', 'medium', 'low', 'none'] as ThreatCategory[]).map((cat) => (
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
                <span className={`${listItemTextClass} text-slate-300 capitalize`}>{cat}</span>
              </label>
            ))}
          </div>
        </div>
      </FilterInput>

      {/* 3. Stationary Confidence */}
      <FilterInput
        label="Stationary Confidence"
        enabled={enabled.stationaryConfidenceMin || enabled.stationaryConfidenceMax}
        onToggle={() => {
          onToggleFilter('stationaryConfidenceMin');
          onToggleFilter('stationaryConfidenceMax');
        }}
        compact={isCompact}
      >
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={filters.stationaryConfidenceMin ?? ''}
            onChange={(e) => onSetFilter('stationaryConfidenceMin', parseFloat(e.target.value))}
            placeholder="Min (0.0)"
            step="0.1"
            min="0"
            max="1"
            className="w-full rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-200"
          />
          <span className="text-slate-500">to</span>
          <input
            type="number"
            value={filters.stationaryConfidenceMax ?? ''}
            onChange={(e) => onSetFilter('stationaryConfidenceMax', parseFloat(e.target.value))}
            placeholder="Max (1.0)"
            step="0.1"
            min="0"
            max="1"
            className="w-full rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-200"
          />
        </div>
      </FilterInput>

      {/* 4. Threat Score Range (Rule-based) */}
      <FilterInput
        label="Rule-Based Score"
        enabled={enabled.ruleBasedScoreMin || enabled.ruleBasedScoreMax}
        onToggle={() => {
          onToggleFilter('ruleBasedScoreMin');
          onToggleFilter('ruleBasedScoreMax');
        }}
        compact={isCompact}
      >
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={filters.ruleBasedScoreMin ?? ''}
            onChange={(e) => onSetFilter('ruleBasedScoreMin', parseFloat(e.target.value))}
            placeholder="Min"
            className="w-full rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-200"
          />
          <span className="text-slate-500">to</span>
          <input
            type="number"
            value={filters.ruleBasedScoreMax ?? ''}
            onChange={(e) => onSetFilter('ruleBasedScoreMax', parseFloat(e.target.value))}
            placeholder="Max"
            className="w-full rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-200"
          />
        </div>
      </FilterInput>

      {/* 5. ML Model Filters */}
      <FilterInput
        label="ML Threat Model"
        enabled={enabled.mlThreatScoreMin || enabled.mlThreatScoreMax || enabled.modelVersion}
        onToggle={() => {
          onToggleFilter('mlThreatScoreMin');
          onToggleFilter('mlThreatScoreMax');
          onToggleFilter('modelVersion');
        }}
        compact={isCompact}
      >
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={filters.mlThreatScoreMin ?? ''}
              onChange={(e) => onSetFilter('mlThreatScoreMin', parseFloat(e.target.value))}
              placeholder="Min Score"
              className="w-full rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-200"
            />
            <span className="text-slate-500">to</span>
            <input
              type="number"
              value={filters.mlThreatScoreMax ?? ''}
              onChange={(e) => onSetFilter('mlThreatScoreMax', parseFloat(e.target.value))}
              placeholder="Max"
              className="w-full rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-200"
            />
          </div>

          <div>
            <input
              type="text"
              value={(filters.modelVersion ?? []).join(', ')}
              onChange={(e) =>
                onSetFilter(
                  'modelVersion',
                  e.target.value
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean)
                )
              }
              placeholder="Model version(s)..."
              className="w-full rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-200"
            />
            <p className="mt-1 text-[10px] text-slate-500 italic">
              Comma-separated e.g. 1.0.0, legacy
            </p>
          </div>
        </div>
      </FilterInput>
    </FilterSection>
  );
};
