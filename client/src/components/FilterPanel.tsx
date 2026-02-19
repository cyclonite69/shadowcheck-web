/**
 * Universal Filter Panel Component
 * Collapsible, categorized filter interface
 */

import React, { useState } from 'react';
import { useFilterStore } from '../stores/filterStore';
import { FilterSection } from './filter';
import { FilterPanelHeader } from './filters/FilterPanelHeader';
import {
  IdentityFilters,
  RadioFilters,
  SecurityFilters,
  TimeFilters,
  ThreatFilters,
  QualityFilters,
  SpatialFilters,
} from './filters/sections';

type FilterPanelDensity = 'normal' | 'compact';

interface FilterPanelProps {
  density?: FilterPanelDensity;
}

export const FilterPanel: React.FC<FilterPanelProps> = ({ density = 'normal' }) => {
  const {
    getCurrentFilters,
    getCurrentEnabled,
    setFilter,
    toggleFilter,
    enableFilter,
    clearFilters,
    resetFilters,
    savePreset,
    loadPreset,
    deletePreset,
    presets,
  } = useFilterStore();

  const filters = getCurrentFilters();
  const enabled = getCurrentEnabled();
  const activeFilterCount = Object.values(enabled || {}).filter(Boolean).length;
  const [presetName, setPresetName] = useState('');

  const isCompact = density === 'compact';
  const listLayoutClass = isCompact ? 'grid grid-cols-2 gap-2' : 'space-y-2';
  const listItemTextClass = isCompact ? 'text-[11px]' : 'text-xs';
  const controlBase =
    'filter-panel__control w-full bg-slate-800 border border-slate-600 rounded text-slate-200 min-w-0';
  const controlSize = isCompact ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm';
  const controlClass = `${controlBase} ${controlSize}`;

  return (
    <div
      className={`filter-panel w-[420px] bg-slate-950 border border-slate-600 rounded-xl text-slate-200 flex flex-col h-full flex-shrink-0 overflow-visible ${
        isCompact ? 'filter-panel--compact' : ''
      }`}
    >
      {/* Header */}
      <FilterPanelHeader
        activeFilterCount={activeFilterCount}
        isCompact={isCompact}
        onClearAll={clearFilters}
        onReset={resetFilters}
      />

      {/* Filter Sections */}
      <div className="flex-1 overflow-y-auto overflow-x-visible">
        {/* Identity Filters */}
        <IdentityFilters
          filters={filters}
          enabled={enabled}
          isCompact={isCompact}
          controlClass={controlClass}
          onSetFilter={setFilter}
          onToggleFilter={toggleFilter}
        />

        {/* Radio / Physical Layer */}
        <RadioFilters
          filters={filters}
          enabled={enabled}
          isCompact={isCompact}
          controlClass={controlClass}
          listLayoutClass={listLayoutClass}
          listItemTextClass={listItemTextClass}
          onSetFilter={setFilter}
          onToggleFilter={toggleFilter}
        />
        <SecurityFilters
          filters={filters}
          enabled={enabled}
          isCompact={isCompact}
          listLayoutClass={listLayoutClass}
          listItemTextClass={listItemTextClass}
          onSetFilter={setFilter}
          onToggleFilter={toggleFilter}
          onEnableFilter={enableFilter}
        />

        {/* Time Range */}
        <TimeFilters
          filters={filters}
          enabled={enabled}
          isCompact={isCompact}
          controlClass={controlClass}
          onSetFilter={setFilter}
          onEnableFilter={enableFilter}
        />

        {/* Threat Analysis */}
        <ThreatFilters
          filters={filters}
          enabled={enabled}
          isCompact={isCompact}
          controlClass={controlClass}
          listLayoutClass={listLayoutClass}
          listItemTextClass={listItemTextClass}
          onSetFilter={setFilter}
          onToggleFilter={toggleFilter}
        />

        {/* Data Quality */}
        <QualityFilters
          filters={filters}
          enabled={enabled}
          isCompact={isCompact}
          controlClass={controlClass}
          onSetFilter={setFilter}
          onToggleFilter={toggleFilter}
        />

        {/* Spatial & Proximity */}
        <SpatialFilters
          filters={filters}
          enabled={enabled}
          isCompact={isCompact}
          controlClass={controlClass}
          onSetFilter={setFilter}
          onToggleFilter={toggleFilter}
        />

        {/* Presets */}
        <FilterSection title="Presets" compact={isCompact}>
          <div className="space-y-2">
            <input
              type="text"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="Preset name"
              className={controlClass}
            />
            <button
              onClick={() => {
                const name = presetName.trim();
                if (!name) return;
                savePreset(name);
                setPresetName('');
              }}
              className="w-full px-3 py-2 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
            >
              Save Preset
            </button>
          </div>

          {Object.keys(presets).length > 0 && (
            <div className="space-y-2">
              {Object.entries(presets).map(([name]) => (
                <div
                  key={name}
                  className="flex items-center justify-between gap-2 rounded border border-slate-700 px-2 py-1"
                >
                  <div className="text-xs text-slate-300">{name}</div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => loadPreset(name)}
                      className="text-xs text-blue-400 hover:text-blue-300"
                    >
                      Load
                    </button>
                    <button
                      onClick={() => deletePreset(name)}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-slate-500">
            Presets store explicit filters + enabled flags as JSON.
          </p>
        </FilterSection>
      </div>
    </div>
  );
};
