/**
 * Universal Filter Panel Component
 * Collapsible, categorized filter interface
 */

import React, { useState } from 'react';
import { useFilterStore } from '../stores/filterStore';
import {
  AuthMethod,
  EncryptionType,
  FrequencyBand,
  InsecureFlag,
  RadioType,
  SecurityFlag,
  TemporalScope,
  ThreatCategory,
} from '../types/filters';
import { FilterSection, FilterInput } from './filter';

const Filter = ({ className = '' }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.414A1 1 0 013 6.707V4z"
    />
  </svg>
);

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
    'filter-panel__control w-full bg-slate-800 border border-slate-600 rounded text-slate-200 box-border';
  const controlSize = isCompact ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm';
  const controlClass = `${controlBase} ${controlSize}`;

  const panelWidthClass = isCompact ? 'w-full sm:w-72' : 'w-full sm:w-80';

  return (
    <div
      className={`filter-panel ${panelWidthClass} bg-slate-950/90 border border-slate-600/60 rounded-lg text-slate-200 flex flex-col h-full flex-shrink-0 overflow-x-hidden ${
        isCompact ? 'filter-panel--compact' : ''
      }`}
      style={{ borderRight: '1px solid rgba(71, 85, 105, 0.8)' }}
    >
      {/* Header */}
      <div
        className={`filter-panel__header border-b border-slate-700 ${isCompact ? 'p-3' : 'p-4'}`}
      >
        <div className={`flex items-center justify-between ${isCompact ? 'mb-2' : 'mb-3'}`}>
          <div className="flex items-center space-x-2">
            <Filter className="filter-panel__header-icon w-5 h-5 text-slate-400" />
            <h2 className="filter-panel__title font-semibold text-slate-200">Filters</h2>
            {activeFilterCount > 0 && (
              <span className="filter-panel__badge px-2 py-1 text-xs bg-blue-600 text-white rounded-full">
                {activeFilterCount}
              </span>
            )}
          </div>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={clearFilters}
            className={`bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors ${
              isCompact ? 'px-1.5 py-0.5 text-[10px]' : 'px-3 py-1 text-xs'
            }`}
          >
            Clear All
          </button>
          <button
            onClick={resetFilters}
            className={`bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors ${
              isCompact ? 'px-1.5 py-0.5 text-[10px]' : 'px-3 py-1 text-xs'
            }`}
          >
            Reset
          </button>
        </div>
      </div>

      {/* Filter Sections */}
      <div className="flex-1 overflow-y-auto">
        {/* Identity Filters */}
        <FilterSection title="Identity" compact={isCompact}>
          <FilterInput
            label="SSID"
            enabled={enabled.ssid || false}
            onToggle={() => toggleFilter('ssid')}
            compact={isCompact}
          >
            <input
              type="text"
              value={filters.ssid || ''}
              onChange={(e) => setFilter('ssid', e.target.value)}
              placeholder="Network name..."
              className={`${controlClass} focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
            />
          </FilterInput>

          <FilterInput
            label="BSSID (exact or prefix)"
            enabled={enabled.bssid || false}
            onToggle={() => toggleFilter('bssid')}
            compact={isCompact}
          >
            <input
              type="text"
              value={filters.bssid || ''}
              onChange={(e) => setFilter('bssid', e.target.value)}
              placeholder="AA:BB:CC:DD:EE:FF or AA:BB:CC"
              className={`${controlClass} focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
            />
            <p className="mt-1 text-xs text-slate-500">
              Full BSSID = exact match. Prefix = starts-with match.
            </p>
          </FilterInput>

          <FilterInput
            label="Manufacturer / OUI"
            enabled={enabled.manufacturer || false}
            onToggle={() => toggleFilter('manufacturer')}
            compact={isCompact}
          >
            <input
              type="text"
              value={filters.manufacturer || ''}
              onChange={(e) => setFilter('manufacturer', e.target.value)}
              placeholder="Apple, Samsung, 001A2B..."
              className={`${controlClass} focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
            />
          </FilterInput>

          <FilterInput
            label="Internal Network ID"
            enabled={enabled.networkId || false}
            onToggle={() => toggleFilter('networkId')}
            compact={isCompact}
          >
            <input
              type="text"
              value={filters.networkId || ''}
              onChange={(e) => setFilter('networkId', e.target.value)}
              placeholder="unified_id..."
              className={`${controlClass} focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
            />
          </FilterInput>
        </FilterSection>

        {/* Radio / Physical Layer */}
        <FilterSection title="Radio & Physical" compact={isCompact}>
          <FilterInput
            label="Radio Types"
            enabled={enabled.radioTypes || false}
            onToggle={() => toggleFilter('radioTypes')}
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
                        : current.filter((t) => t !== type);
                      setFilter('radioTypes', updated);
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
            onToggle={() => toggleFilter('frequencyBands')}
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
                        : current.filter((b) => b !== band);
                      setFilter('frequencyBands', updated);
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
            onToggle={() => toggleFilter('channelMin')}
            compact={isCompact}
          >
            <input
              type="number"
              value={filters.channelMin ?? ''}
              onChange={(e) => setFilter('channelMin', parseInt(e.target.value, 10))}
              placeholder="e.g. 1"
              className={controlClass}
            />
          </FilterInput>

          <FilterInput
            label="Channel Max"
            enabled={enabled.channelMax || false}
            onToggle={() => toggleFilter('channelMax')}
            compact={isCompact}
          >
            <input
              type="number"
              value={filters.channelMax ?? ''}
              onChange={(e) => setFilter('channelMax', parseInt(e.target.value, 10))}
              placeholder="e.g. 165"
              className={controlClass}
            />
          </FilterInput>

          <FilterInput
            label="RSSI Min (dBm)"
            enabled={enabled.rssiMin || false}
            onToggle={() => toggleFilter('rssiMin')}
            compact={isCompact}
          >
            <input
              type="number"
              value={filters.rssiMin ?? ''}
              onChange={(e) => setFilter('rssiMin', parseInt(e.target.value, 10))}
              placeholder="-95"
              className={controlClass}
            />
            <p className="mt-1 text-xs text-slate-500">Noise floor enforced at -95 dBm.</p>
          </FilterInput>

          <FilterInput
            label="RSSI Max (dBm)"
            enabled={enabled.rssiMax || false}
            onToggle={() => toggleFilter('rssiMax')}
            compact={isCompact}
          >
            <input
              type="number"
              value={filters.rssiMax ?? ''}
              onChange={(e) => setFilter('rssiMax', parseInt(e.target.value, 10))}
              placeholder="-30"
              className={controlClass}
            />
          </FilterInput>
        </FilterSection>

        {/* Security */}
        <FilterSection title="Security" compact={isCompact}>
          <FilterInput
            label="Encryption Types"
            enabled={enabled.encryptionTypes || false}
            onToggle={() => toggleFilter('encryptionTypes')}
            compact={isCompact}
          >
            <div className={listLayoutClass}>
              {(['OPEN', 'WEP', 'WPA', 'WPA2', 'WPA3'] as EncryptionType[]).map((type) => (
                <label key={type} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={filters.encryptionTypes?.includes(type) || false}
                    onChange={(e) => {
                      const current = filters.encryptionTypes || [];
                      const updated = e.target.checked
                        ? [...current, type]
                        : current.filter((t) => t !== type);
                      setFilter('encryptionTypes', updated);
                    }}
                    className="filter-panel__checkbox rounded border-slate-600 bg-slate-800 text-blue-500"
                  />
                  <span className={`${listItemTextClass} text-slate-300`}>{type}</span>
                </label>
              ))}
            </div>
          </FilterInput>

          <FilterInput
            label="Auth Methods"
            enabled={enabled.authMethods || false}
            onToggle={() => toggleFilter('authMethods')}
            compact={isCompact}
          >
            <div className={listLayoutClass}>
              {(['PSK', 'Enterprise', 'SAE', 'OWE', 'None'] as AuthMethod[]).map((method) => (
                <label key={method} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={filters.authMethods?.includes(method) || false}
                    onChange={(e) => {
                      const current = filters.authMethods || [];
                      const updated = e.target.checked
                        ? [...current, method]
                        : current.filter((m) => m !== method);
                      setFilter('authMethods', updated);
                    }}
                    className="filter-panel__checkbox rounded border-slate-600 bg-slate-800 text-blue-500"
                  />
                  <span className={`${listItemTextClass} text-slate-300`}>{method}</span>
                </label>
              ))}
            </div>
          </FilterInput>

          <FilterInput
            label="Insecure Flags"
            enabled={enabled.insecureFlags || false}
            onToggle={() => toggleFilter('insecureFlags')}
            compact={isCompact}
          >
            <div className={listLayoutClass}>
              {(['open', 'wep', 'wps', 'deprecated'] as InsecureFlag[]).map((flag) => (
                <label key={flag} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={filters.insecureFlags?.includes(flag) || false}
                    onChange={(e) => {
                      const current = filters.insecureFlags || [];
                      const updated = e.target.checked
                        ? [...current, flag]
                        : current.filter((f) => f !== flag);
                      setFilter('insecureFlags', updated);
                    }}
                    className="filter-panel__checkbox rounded border-slate-600 bg-slate-800 text-blue-500"
                  />
                  <span className={`${listItemTextClass} text-slate-300 capitalize`}>{flag}</span>
                </label>
              ))}
            </div>
          </FilterInput>

          <FilterInput
            label="Security Inference Flags"
            enabled={enabled.securityFlags || false}
            onToggle={() => toggleFilter('securityFlags')}
            compact={isCompact}
          >
            <div className={listLayoutClass}>
              {(
                ['insecure', 'deprecated', 'enterprise', 'personal', 'unknown'] as SecurityFlag[]
              ).map((flag) => (
                <label key={flag} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={filters.securityFlags?.includes(flag) || false}
                    onChange={(e) => {
                      const current = filters.securityFlags || [];
                      const updated = e.target.checked
                        ? [...current, flag]
                        : current.filter((f) => f !== flag);
                      setFilter('securityFlags', updated);
                    }}
                    className="filter-panel__checkbox rounded border-slate-600 bg-slate-800 text-blue-500"
                  />
                  <span className={`${listItemTextClass} text-slate-300 capitalize`}>{flag}</span>
                </label>
              ))}
            </div>
          </FilterInput>
        </FilterSection>

        {/* Temporal */}
        <FilterSection title="Time Range" compact={isCompact}>
          <FilterInput
            label="Timeframe"
            enabled={enabled.timeframe || false}
            onToggle={() => {
              const next = !enabled.timeframe;
              enableFilter('timeframe', next);
              enableFilter('temporalScope', next);
            }}
            compact={isCompact}
          >
            <div className="space-y-3">
              <div>
                <label htmlFor="temporal-scope-select" className="text-xs text-slate-400">
                  Temporal Scope
                </label>
                <select
                  id="temporal-scope-select"
                  value={filters.temporalScope || TemporalScope.OBSERVATION_TIME}
                  onChange={(e) => setFilter('temporalScope', e.target.value as TemporalScope)}
                  className={`${controlClass} mt-1`}
                >
                  <option value={TemporalScope.OBSERVATION_TIME}>Observation Time</option>
                  <option value={TemporalScope.NETWORK_LIFETIME}>Network Lifetime</option>
                  <option value={TemporalScope.THREAT_WINDOW}>Threat Window</option>
                </select>
              </div>

              <div>
                <label htmlFor="timeframe-mode-select" className="text-xs text-slate-400">
                  Mode
                </label>
                <select
                  id="timeframe-mode-select"
                  value={filters.timeframe?.type || 'relative'}
                  onChange={(e) =>
                    setFilter('timeframe', {
                      ...(filters.timeframe || {}),
                      type: e.target.value as 'relative' | 'absolute',
                    })
                  }
                  className={`${controlClass} mt-1`}
                >
                  <option value="relative">Relative</option>
                  <option value="absolute">Absolute</option>
                </select>
              </div>

              {filters.timeframe?.type !== 'absolute' ? (
                <div>
                  <label htmlFor="relative-window-select" className="text-xs text-slate-400">
                    Relative Window
                  </label>
                  <select
                    id="relative-window-select"
                    value={filters.timeframe?.relativeWindow || '30d'}
                    onChange={(e) =>
                      setFilter('timeframe', {
                        type: 'relative',
                        relativeWindow: e.target.value as any,
                      })
                    }
                    className={`${controlClass} mt-1`}
                  >
                    <option value="24h">Last 24 hours</option>
                    <option value="7d">Last 7 days</option>
                    <option value="30d">Last 30 days</option>
                    <option value="90d">Last 90 days</option>
                    <option value="6mo">Last 6 months</option>
                    <option value="9mo">Last 9 months</option>
                    <option value="1y">Last 1 year</option>
                    <option value="18mo">Last 18 months</option>
                    <option value="2y">Last 2 years</option>
                    <option value="all">All time</option>
                  </select>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  <div>
                    <label htmlFor="timeframe-start-input" className="text-xs text-slate-400">
                      Start (ISO)
                    </label>
                    <input
                      id="timeframe-start-input"
                      type="datetime-local"
                      value={filters.timeframe?.startTimestamp || ''}
                      onChange={(e) =>
                        setFilter('timeframe', {
                          type: 'absolute',
                          startTimestamp: e.target.value,
                          endTimestamp: filters.timeframe?.endTimestamp,
                        })
                      }
                      className={`${controlClass} mt-1`}
                    />
                  </div>
                  <div>
                    <label htmlFor="timeframe-end-input" className="text-xs text-slate-400">
                      End (ISO)
                    </label>
                    <input
                      id="timeframe-end-input"
                      type="datetime-local"
                      value={filters.timeframe?.endTimestamp || ''}
                      onChange={(e) =>
                        setFilter('timeframe', {
                          type: 'absolute',
                          startTimestamp: filters.timeframe?.startTimestamp,
                          endTimestamp: e.target.value,
                        })
                      }
                      className={`${controlClass} mt-1`}
                    />
                  </div>
                </div>
              )}
            </div>
          </FilterInput>
        </FilterSection>

        {/* Threat & Heuristics */}
        <FilterSection title="Threat Analysis" compact={isCompact}>
          <FilterInput
            label="Threat Score Min"
            enabled={enabled.threatScoreMin || false}
            onToggle={() => toggleFilter('threatScoreMin')}
            compact={isCompact}
          >
            <input
              type="number"
              min="0"
              max="100"
              value={filters.threatScoreMin || ''}
              onChange={(e) => setFilter('threatScoreMin', parseInt(e.target.value, 10))}
              placeholder="Min"
              className={controlClass}
            />
          </FilterInput>

          <FilterInput
            label="Threat Score Max"
            enabled={enabled.threatScoreMax || false}
            onToggle={() => toggleFilter('threatScoreMax')}
            compact={isCompact}
          >
            <input
              type="number"
              min="0"
              max="100"
              value={filters.threatScoreMax || ''}
              onChange={(e) => setFilter('threatScoreMax', parseInt(e.target.value, 10))}
              placeholder="Max"
              className={controlClass}
            />
          </FilterInput>

          <FilterInput
            label="Threat Categories"
            enabled={enabled.threatCategories || false}
            onToggle={() => toggleFilter('threatCategories')}
            compact={isCompact}
          >
            <div className={listLayoutClass}>
              {(['critical', 'high', 'medium', 'low'] as ThreatCategory[]).map((category) => (
                <label key={category} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={filters.threatCategories?.includes(category) || false}
                    onChange={(e) => {
                      const current = filters.threatCategories || [];
                      const updated = e.target.checked
                        ? [...current, category]
                        : current.filter((c) => c !== category);
                      setFilter('threatCategories', updated);
                    }}
                    className="filter-panel__checkbox rounded border-slate-600 bg-slate-800 text-blue-500"
                  />
                  <span
                    className={`${listItemTextClass} capitalize ${
                      category === 'critical'
                        ? 'text-red-400'
                        : category === 'high'
                          ? 'text-orange-400'
                          : category === 'medium'
                            ? 'text-yellow-400'
                            : 'text-green-400'
                    }`}
                  >
                    {category}
                  </span>
                </label>
              ))}
            </div>
          </FilterInput>

          <FilterInput
            label="Stationary Confidence Min"
            enabled={enabled.stationaryConfidenceMin || false}
            onToggle={() => toggleFilter('stationaryConfidenceMin')}
            compact={isCompact}
          >
            <input
              type="number"
              min="0"
              max="1"
              step="0.01"
              value={filters.stationaryConfidenceMin ?? ''}
              onChange={(e) => setFilter('stationaryConfidenceMin', parseFloat(e.target.value))}
              placeholder="0.0 - 1.0"
              className={controlClass}
            />
          </FilterInput>

          <FilterInput
            label="Stationary Confidence Max"
            enabled={enabled.stationaryConfidenceMax || false}
            onToggle={() => toggleFilter('stationaryConfidenceMax')}
            compact={isCompact}
          >
            <input
              type="number"
              min="0"
              max="1"
              step="0.01"
              value={filters.stationaryConfidenceMax ?? ''}
              onChange={(e) => setFilter('stationaryConfidenceMax', parseFloat(e.target.value))}
              placeholder="0.0 - 1.0"
              className={controlClass}
            />
            <p className="mt-1 text-xs text-slate-500">
              Derived from spatial variance + temporal spread + observation density.
            </p>
          </FilterInput>
        </FilterSection>

        {/* Observation Quality */}
        <FilterSection title="Data Quality" compact={isCompact}>
          <p className="text-xs text-slate-500">
            Credibility heuristics only. Disabled by default.
          </p>
          <FilterInput
            label="Observation Count Min"
            enabled={enabled.observationCountMin || false}
            onToggle={() => toggleFilter('observationCountMin')}
            compact={isCompact}
          >
            <input
              type="number"
              min="1"
              value={filters.observationCountMin || ''}
              onChange={(e) => setFilter('observationCountMin', parseInt(e.target.value, 10))}
              placeholder="Min obs"
              className={controlClass}
            />
          </FilterInput>

          <FilterInput
            label="Observation Count Max"
            enabled={enabled.observationCountMax || false}
            onToggle={() => toggleFilter('observationCountMax')}
            compact={isCompact}
          >
            <input
              type="number"
              min="1"
              value={filters.observationCountMax || ''}
              onChange={(e) => setFilter('observationCountMax', parseInt(e.target.value, 10))}
              placeholder="Max obs"
              className={controlClass}
            />
          </FilterInput>

          <FilterInput
            label="GPS Accuracy Limit"
            enabled={enabled.gpsAccuracyMax || false}
            onToggle={() => toggleFilter('gpsAccuracyMax')}
            compact={isCompact}
          >
            <input
              type="number"
              min="1"
              value={filters.gpsAccuracyMax || 100}
              onChange={(e) => setFilter('gpsAccuracyMax', parseInt(e.target.value))}
              placeholder="Max meters"
              className={controlClass}
            />
          </FilterInput>

          <FilterInput
            label="Quality Filter"
            enabled={enabled.qualityFilter || false}
            onToggle={() => toggleFilter('qualityFilter')}
            compact={isCompact}
          >
            <select
              aria-label="Quality filter options"
              value={filters.qualityFilter || 'none'}
              onChange={(e) => setFilter('qualityFilter', e.target.value)}
              className={controlClass}
            >
              <option value="none">No Filter</option>
              <option value="temporal">Exclude Temporal Clusters</option>
              <option value="extreme">Exclude Extreme Signals</option>
              <option value="duplicate">Exclude Duplicate Coords</option>
              <option value="all">Exclude All Anomalies</option>
            </select>
          </FilterInput>

          <FilterInput
            label="Exclude Invalid Coordinates"
            enabled={enabled.excludeInvalidCoords || false}
            onToggle={() => toggleFilter('excludeInvalidCoords')}
            compact={isCompact}
          >
            <p className="text-xs text-slate-400">
              Removes observations with NULL or out-of-range lat/lon.
            </p>
          </FilterInput>
        </FilterSection>

        {/* Spatial / Proximity */}
        <FilterSection title="Spatial & Proximity" compact={isCompact}>
          <FilterInput
            label="Distance From Home Min (meters)"
            enabled={enabled.distanceFromHomeMin || false}
            onToggle={() => toggleFilter('distanceFromHomeMin')}
            compact={isCompact}
          >
            <input
              type="number"
              min="0"
              value={filters.distanceFromHomeMin ?? ''}
              onChange={(e) => setFilter('distanceFromHomeMin', parseInt(e.target.value, 10))}
              placeholder="Min meters"
              className={controlClass}
            />
          </FilterInput>

          <FilterInput
            label="Distance From Home Max (meters)"
            enabled={enabled.distanceFromHomeMax || false}
            onToggle={() => toggleFilter('distanceFromHomeMax')}
            compact={isCompact}
          >
            <input
              type="number"
              min="0"
              value={filters.distanceFromHomeMax ?? ''}
              onChange={(e) => setFilter('distanceFromHomeMax', parseInt(e.target.value, 10))}
              placeholder="Max meters"
              className={controlClass}
            />
          </FilterInput>

          <FilterInput
            label="Bounding Box"
            enabled={enabled.boundingBox || false}
            onToggle={() => toggleFilter('boundingBox')}
            compact={isCompact}
          >
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                value={filters.boundingBox?.north ?? ''}
                onChange={(e) =>
                  setFilter('boundingBox', {
                    ...(filters.boundingBox || {}),
                    north: parseFloat(e.target.value),
                  })
                }
                placeholder="North"
                className="filter-panel__control px-2 py-1 bg-slate-800 border border-slate-600 rounded text-slate-200 text-sm box-border"
              />
              <input
                type="number"
                value={filters.boundingBox?.south ?? ''}
                onChange={(e) =>
                  setFilter('boundingBox', {
                    ...(filters.boundingBox || {}),
                    south: parseFloat(e.target.value),
                  })
                }
                placeholder="South"
                className="filter-panel__control px-2 py-1 bg-slate-800 border border-slate-600 rounded text-slate-200 text-sm box-border"
              />
              <input
                type="number"
                value={filters.boundingBox?.east ?? ''}
                onChange={(e) =>
                  setFilter('boundingBox', {
                    ...(filters.boundingBox || {}),
                    east: parseFloat(e.target.value),
                  })
                }
                placeholder="East"
                className="filter-panel__control px-2 py-1 bg-slate-800 border border-slate-600 rounded text-slate-200 text-sm box-border"
              />
              <input
                type="number"
                value={filters.boundingBox?.west ?? ''}
                onChange={(e) =>
                  setFilter('boundingBox', {
                    ...(filters.boundingBox || {}),
                    west: parseFloat(e.target.value),
                  })
                }
                placeholder="West"
                className="filter-panel__control px-2 py-1 bg-slate-800 border border-slate-600 rounded text-slate-200 text-sm box-border"
              />
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Can be populated from map bounds when enabled.
            </p>
          </FilterInput>

          <FilterInput
            label="Radius Filter (meters)"
            enabled={enabled.radiusFilter || false}
            onToggle={() => toggleFilter('radiusFilter')}
            compact={isCompact}
          >
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                value={filters.radiusFilter?.latitude ?? ''}
                onChange={(e) =>
                  setFilter('radiusFilter', {
                    ...(filters.radiusFilter || {}),
                    latitude: parseFloat(e.target.value),
                  })
                }
                placeholder="Latitude"
                className="filter-panel__control px-2 py-1 bg-slate-800 border border-slate-600 rounded text-slate-200 text-sm box-border"
              />
              <input
                type="number"
                value={filters.radiusFilter?.longitude ?? ''}
                onChange={(e) =>
                  setFilter('radiusFilter', {
                    ...(filters.radiusFilter || {}),
                    longitude: parseFloat(e.target.value),
                  })
                }
                placeholder="Longitude"
                className="filter-panel__control px-2 py-1 bg-slate-800 border border-slate-600 rounded text-slate-200 text-sm box-border"
              />
              <input
                type="number"
                value={filters.radiusFilter?.radiusMeters ?? ''}
                onChange={(e) =>
                  setFilter('radiusFilter', {
                    ...(filters.radiusFilter || {}),
                    radiusMeters: parseFloat(e.target.value),
                  })
                }
                placeholder="Radius (m)"
                className="filter-panel__control col-span-2 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-slate-200 text-sm box-border"
              />
            </div>
          </FilterInput>
        </FilterSection>

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
