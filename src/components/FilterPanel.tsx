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

// Icons
const ChevronDown = ({ className = '' }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

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

interface FilterSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

const FilterSection: React.FC<FilterSectionProps> = ({ title, children, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-slate-700">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 text-left hover:bg-slate-800/50 transition-colors"
      >
        <span className="font-medium text-slate-200">{title}</span>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      {isOpen && <div className="p-3 space-y-3 bg-slate-900/30">{children}</div>}
    </div>
  );
};

interface FilterInputProps {
  label: string;
  enabled: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

const FilterInput: React.FC<FilterInputProps> = ({ label, enabled, onToggle, children }) => (
  <div className="space-y-2">
    <label className="flex items-center space-x-2">
      <input
        type="checkbox"
        checked={enabled}
        onChange={onToggle}
        className="rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500"
      />
      <span className="text-sm text-slate-300">{label}</span>
    </label>
    {enabled && <div className="ml-6">{children}</div>}
  </div>
);

export const FilterPanel: React.FC = () => {
  const {
    filters,
    enabled,
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

  const activeFilterCount = Object.values(enabled).filter(Boolean).length;
  const [presetName, setPresetName] = useState('');

  return (
    <div
      className="w-80 bg-slate-900 border-r border-slate-700 flex flex-col h-full flex-shrink-0"
      style={{
        width: 320,
        minWidth: 320,
        background: 'rgba(15, 23, 42, 0.92)',
        borderRight: '1px solid rgba(71, 85, 105, 0.6)',
        color: '#e2e8f0',
      }}
    >
      {/* Header */}
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Filter className="w-5 h-5 text-slate-400" />
            <h2 className="font-semibold text-slate-200">Filters</h2>
            {activeFilterCount > 0 && (
              <span className="px-2 py-1 text-xs bg-blue-600 text-white rounded-full">
                {activeFilterCount}
              </span>
            )}
          </div>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={clearFilters}
            className="px-3 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors"
          >
            Clear All
          </button>
          <button
            onClick={resetFilters}
            className="px-3 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Filter Sections */}
      <div className="flex-1 overflow-y-auto">
        {/* Identity Filters */}
        <FilterSection title="Identity" defaultOpen>
          <FilterInput
            label="SSID"
            enabled={enabled.ssid || false}
            onToggle={() => toggleFilter('ssid')}
          >
            <input
              type="text"
              value={filters.ssid || ''}
              onChange={(e) => setFilter('ssid', e.target.value)}
              placeholder="Network name..."
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-slate-200 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </FilterInput>

          <FilterInput
            label="BSSID (exact or prefix)"
            enabled={enabled.bssid || false}
            onToggle={() => toggleFilter('bssid')}
          >
            <input
              type="text"
              value={filters.bssid || ''}
              onChange={(e) => setFilter('bssid', e.target.value)}
              placeholder="AA:BB:CC:DD:EE:FF or AA:BB:CC"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-slate-200 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="mt-1 text-xs text-slate-500">
              Full BSSID = exact match. Prefix = starts-with match.
            </p>
          </FilterInput>

          <FilterInput
            label="Manufacturer / OUI"
            enabled={enabled.manufacturer || false}
            onToggle={() => toggleFilter('manufacturer')}
          >
            <input
              type="text"
              value={filters.manufacturer || ''}
              onChange={(e) => setFilter('manufacturer', e.target.value)}
              placeholder="Apple, Samsung, 001A2B..."
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-slate-200 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </FilterInput>

          <FilterInput
            label="Internal Network ID"
            enabled={enabled.networkId || false}
            onToggle={() => toggleFilter('networkId')}
          >
            <input
              type="text"
              value={filters.networkId || ''}
              onChange={(e) => setFilter('networkId', e.target.value)}
              placeholder="unified_id..."
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-slate-200 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </FilterInput>
        </FilterSection>

        {/* Radio / Physical Layer */}
        <FilterSection title="Radio & Physical">
          <FilterInput
            label="Radio Types"
            enabled={enabled.radioTypes || false}
            onToggle={() => toggleFilter('radioTypes')}
          >
            <div className="space-y-2">
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
                    className="rounded border-slate-600 bg-slate-800 text-blue-500"
                  />
                  <span className="text-xs text-slate-300">
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
          >
            <div className="space-y-2">
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
                    className="rounded border-slate-600 bg-slate-800 text-blue-500"
                  />
                  <span className="text-xs text-slate-300">{band}</span>
                </label>
              ))}
            </div>
          </FilterInput>

          <FilterInput
            label="Channel Min"
            enabled={enabled.channelMin || false}
            onToggle={() => toggleFilter('channelMin')}
          >
            <input
              type="number"
              value={filters.channelMin ?? ''}
              onChange={(e) => setFilter('channelMin', parseInt(e.target.value, 10))}
              placeholder="e.g. 1"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-slate-200 text-sm"
            />
          </FilterInput>

          <FilterInput
            label="Channel Max"
            enabled={enabled.channelMax || false}
            onToggle={() => toggleFilter('channelMax')}
          >
            <input
              type="number"
              value={filters.channelMax ?? ''}
              onChange={(e) => setFilter('channelMax', parseInt(e.target.value, 10))}
              placeholder="e.g. 165"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-slate-200 text-sm"
            />
          </FilterInput>

          <FilterInput
            label="RSSI Min (dBm)"
            enabled={enabled.rssiMin || false}
            onToggle={() => toggleFilter('rssiMin')}
          >
            <input
              type="number"
              value={filters.rssiMin ?? ''}
              onChange={(e) => setFilter('rssiMin', parseInt(e.target.value, 10))}
              placeholder="-95"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-slate-200 text-sm"
            />
            <p className="mt-1 text-xs text-slate-500">Noise floor enforced at -95 dBm.</p>
          </FilterInput>

          <FilterInput
            label="RSSI Max (dBm)"
            enabled={enabled.rssiMax || false}
            onToggle={() => toggleFilter('rssiMax')}
          >
            <input
              type="number"
              value={filters.rssiMax ?? ''}
              onChange={(e) => setFilter('rssiMax', parseInt(e.target.value, 10))}
              placeholder="-30"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-slate-200 text-sm"
            />
          </FilterInput>
        </FilterSection>

        {/* Security */}
        <FilterSection title="Security">
          <FilterInput
            label="Encryption Types"
            enabled={enabled.encryptionTypes || false}
            onToggle={() => toggleFilter('encryptionTypes')}
          >
            <div className="space-y-2">
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
                    className="rounded border-slate-600 bg-slate-800 text-blue-500"
                  />
                  <span className="text-xs text-slate-300">{type}</span>
                </label>
              ))}
            </div>
          </FilterInput>

          <FilterInput
            label="Auth Methods"
            enabled={enabled.authMethods || false}
            onToggle={() => toggleFilter('authMethods')}
          >
            <div className="space-y-2">
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
                    className="rounded border-slate-600 bg-slate-800 text-blue-500"
                  />
                  <span className="text-xs text-slate-300">{method}</span>
                </label>
              ))}
            </div>
          </FilterInput>

          <FilterInput
            label="Insecure Flags"
            enabled={enabled.insecureFlags || false}
            onToggle={() => toggleFilter('insecureFlags')}
          >
            <div className="space-y-2">
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
                    className="rounded border-slate-600 bg-slate-800 text-blue-500"
                  />
                  <span className="text-xs text-slate-300 capitalize">{flag}</span>
                </label>
              ))}
            </div>
          </FilterInput>

          <FilterInput
            label="Security Inference Flags"
            enabled={enabled.securityFlags || false}
            onToggle={() => toggleFilter('securityFlags')}
          >
            <div className="space-y-2">
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
                    className="rounded border-slate-600 bg-slate-800 text-blue-500"
                  />
                  <span className="text-xs text-slate-300 capitalize">{flag}</span>
                </label>
              ))}
            </div>
          </FilterInput>
        </FilterSection>

        {/* Temporal */}
        <FilterSection title="Time Range" defaultOpen>
          <FilterInput
            label="Timeframe"
            enabled={enabled.timeframe || false}
            onToggle={() => {
              const next = !enabled.timeframe;
              enableFilter('timeframe', next);
              enableFilter('temporalScope', next);
            }}
          >
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400">Temporal Scope</label>
                <select
                  value={filters.temporalScope || TemporalScope.OBSERVATION_TIME}
                  onChange={(e) => setFilter('temporalScope', e.target.value as TemporalScope)}
                  className="mt-1 w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-slate-200 text-sm"
                >
                  <option value={TemporalScope.OBSERVATION_TIME}>Observation Time</option>
                  <option value={TemporalScope.NETWORK_LIFETIME}>Network Lifetime</option>
                  <option value={TemporalScope.THREAT_WINDOW}>Threat Window</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400">Mode</label>
                <select
                  value={filters.timeframe?.type || 'relative'}
                  onChange={(e) =>
                    setFilter('timeframe', {
                      ...(filters.timeframe || {}),
                      type: e.target.value as 'relative' | 'absolute',
                    })
                  }
                  className="mt-1 w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-slate-200 text-sm"
                >
                  <option value="relative">Relative</option>
                  <option value="absolute">Absolute</option>
                </select>
              </div>

              {filters.timeframe?.type !== 'absolute' ? (
                <div>
                  <label className="text-xs text-slate-400">Relative Window</label>
                  <select
                    value={filters.timeframe?.relativeWindow || '30d'}
                    onChange={(e) =>
                      setFilter('timeframe', {
                        type: 'relative',
                        relativeWindow: e.target.value as any,
                      })
                    }
                    className="mt-1 w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-slate-200 text-sm"
                  >
                    <option value="24h">Last 24 hours</option>
                    <option value="7d">Last 7 days</option>
                    <option value="30d">Last 30 days</option>
                    <option value="90d">Last 90 days</option>
                    <option value="all">All time</option>
                  </select>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  <div>
                    <label className="text-xs text-slate-400">Start (ISO)</label>
                    <input
                      type="datetime-local"
                      value={filters.timeframe?.startTimestamp || ''}
                      onChange={(e) =>
                        setFilter('timeframe', {
                          type: 'absolute',
                          startTimestamp: e.target.value,
                          endTimestamp: filters.timeframe?.endTimestamp,
                        })
                      }
                      className="mt-1 w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-slate-200 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">End (ISO)</label>
                    <input
                      type="datetime-local"
                      value={filters.timeframe?.endTimestamp || ''}
                      onChange={(e) =>
                        setFilter('timeframe', {
                          type: 'absolute',
                          startTimestamp: filters.timeframe?.startTimestamp,
                          endTimestamp: e.target.value,
                        })
                      }
                      className="mt-1 w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-slate-200 text-sm"
                    />
                  </div>
                </div>
              )}
            </div>
          </FilterInput>
        </FilterSection>

        {/* Threat & Heuristics */}
        <FilterSection title="Threat Analysis">
          <FilterInput
            label="Threat Score Min"
            enabled={enabled.threatScoreMin || false}
            onToggle={() => toggleFilter('threatScoreMin')}
          >
            <input
              type="number"
              min="0"
              max="100"
              value={filters.threatScoreMin || ''}
              onChange={(e) => setFilter('threatScoreMin', parseInt(e.target.value, 10))}
              placeholder="Min"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-slate-200 text-sm"
            />
          </FilterInput>

          <FilterInput
            label="Threat Score Max"
            enabled={enabled.threatScoreMax || false}
            onToggle={() => toggleFilter('threatScoreMax')}
          >
            <input
              type="number"
              min="0"
              max="100"
              value={filters.threatScoreMax || ''}
              onChange={(e) => setFilter('threatScoreMax', parseInt(e.target.value, 10))}
              placeholder="Max"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-slate-200 text-sm"
            />
          </FilterInput>

          <FilterInput
            label="Threat Categories"
            enabled={enabled.threatCategories || false}
            onToggle={() => toggleFilter('threatCategories')}
          >
            <div className="space-y-2">
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
                    className="rounded border-slate-600 bg-slate-800 text-blue-500"
                  />
                  <span
                    className={`text-xs capitalize ${
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
          >
            <input
              type="number"
              min="0"
              max="1"
              step="0.01"
              value={filters.stationaryConfidenceMin ?? ''}
              onChange={(e) => setFilter('stationaryConfidenceMin', parseFloat(e.target.value))}
              placeholder="0.0 - 1.0"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-slate-200 text-sm"
            />
          </FilterInput>

          <FilterInput
            label="Stationary Confidence Max"
            enabled={enabled.stationaryConfidenceMax || false}
            onToggle={() => toggleFilter('stationaryConfidenceMax')}
          >
            <input
              type="number"
              min="0"
              max="1"
              step="0.01"
              value={filters.stationaryConfidenceMax ?? ''}
              onChange={(e) => setFilter('stationaryConfidenceMax', parseFloat(e.target.value))}
              placeholder="0.0 - 1.0"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-slate-200 text-sm"
            />
            <p className="mt-1 text-xs text-slate-500">
              Derived from spatial variance + temporal spread + observation density.
            </p>
          </FilterInput>
        </FilterSection>

        {/* Observation Quality */}
        <FilterSection title="Data Quality">
          <p className="text-xs text-slate-500">
            Credibility heuristics only. Disabled by default.
          </p>
          <FilterInput
            label="Observation Count Min"
            enabled={enabled.observationCountMin || false}
            onToggle={() => toggleFilter('observationCountMin')}
          >
            <input
              type="number"
              min="1"
              value={filters.observationCountMin || ''}
              onChange={(e) => setFilter('observationCountMin', parseInt(e.target.value, 10))}
              placeholder="Min obs"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-slate-200 text-sm"
            />
          </FilterInput>

          <FilterInput
            label="Observation Count Max"
            enabled={enabled.observationCountMax || false}
            onToggle={() => toggleFilter('observationCountMax')}
          >
            <input
              type="number"
              min="1"
              value={filters.observationCountMax || ''}
              onChange={(e) => setFilter('observationCountMax', parseInt(e.target.value, 10))}
              placeholder="Max obs"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-slate-200 text-sm"
            />
          </FilterInput>

          <FilterInput
            label="GPS Accuracy Limit"
            enabled={enabled.gpsAccuracyMax || false}
            onToggle={() => toggleFilter('gpsAccuracyMax')}
          >
            <input
              type="number"
              min="1"
              value={filters.gpsAccuracyMax || 100}
              onChange={(e) => setFilter('gpsAccuracyMax', parseInt(e.target.value))}
              placeholder="Max meters"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-slate-200 text-sm"
            />
          </FilterInput>

          <FilterInput
            label="Exclude Invalid Coordinates"
            enabled={enabled.excludeInvalidCoords || false}
            onToggle={() => toggleFilter('excludeInvalidCoords')}
          >
            <p className="text-xs text-slate-400">
              Removes observations with NULL or out-of-range lat/lon.
            </p>
          </FilterInput>
        </FilterSection>

        {/* Spatial / Proximity */}
        <FilterSection title="Spatial & Proximity">
          <FilterInput
            label="Distance From Home Min (meters)"
            enabled={enabled.distanceFromHomeMin || false}
            onToggle={() => toggleFilter('distanceFromHomeMin')}
          >
            <input
              type="number"
              min="0"
              value={filters.distanceFromHomeMin ?? ''}
              onChange={(e) => setFilter('distanceFromHomeMin', parseInt(e.target.value, 10))}
              placeholder="Min meters"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-slate-200 text-sm"
            />
          </FilterInput>

          <FilterInput
            label="Distance From Home Max (meters)"
            enabled={enabled.distanceFromHomeMax || false}
            onToggle={() => toggleFilter('distanceFromHomeMax')}
          >
            <input
              type="number"
              min="0"
              value={filters.distanceFromHomeMax ?? ''}
              onChange={(e) => setFilter('distanceFromHomeMax', parseInt(e.target.value, 10))}
              placeholder="Max meters"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-slate-200 text-sm"
            />
          </FilterInput>

          <FilterInput
            label="Bounding Box"
            enabled={enabled.boundingBox || false}
            onToggle={() => toggleFilter('boundingBox')}
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
                className="px-2 py-1 bg-slate-800 border border-slate-600 rounded text-slate-200 text-sm"
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
                className="px-2 py-1 bg-slate-800 border border-slate-600 rounded text-slate-200 text-sm"
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
                className="px-2 py-1 bg-slate-800 border border-slate-600 rounded text-slate-200 text-sm"
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
                className="px-2 py-1 bg-slate-800 border border-slate-600 rounded text-slate-200 text-sm"
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
                className="px-2 py-1 bg-slate-800 border border-slate-600 rounded text-slate-200 text-sm"
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
                className="px-2 py-1 bg-slate-800 border border-slate-600 rounded text-slate-200 text-sm"
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
                className="col-span-2 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-slate-200 text-sm"
              />
            </div>
          </FilterInput>
        </FilterSection>

        {/* Presets */}
        <FilterSection title="Presets">
          <div className="space-y-2">
            <input
              type="text"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="Preset name"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-slate-200 text-sm"
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
