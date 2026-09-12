import React from 'react';
import { AdminCard } from '../../components/AdminCard';
import { US_STATES } from '../../../../constants/network';
import { DatabaseIcon } from './WigleSearchIcons';
import type { WigleSearchParams } from '../../../../types/admin';
import type { BtSearchParams } from '../../hooks/useWigleBluetooth';
import type { SavedTerm } from '../../hooks/useWigleSavedTerms';

export const SURVEILLANCE_MFGR_PRESETS = [
  { label: 'Raven / SoundThinking (2504)', min: 2504, max: 2504 },
  { label: 'Flock Safety BLE (1447)', min: 1447, max: 1447 },
  { label: 'Apple (76)', min: 76, max: 76 },
  { label: 'Custom range', min: null, max: null },
] as const;

export interface WigleNetworkFiltersCardProps {
  searchType: 'wifi' | 'bluetooth';
  searchParams: WigleSearchParams;
  setSearchParams: React.Dispatch<React.SetStateAction<WigleSearchParams>>;
  btParams: BtSearchParams;
  setBtParams: React.Dispatch<React.SetStateAction<BtSearchParams>>;
  savedTerms: SavedTerm[];
  ssidDropdownOpen: boolean;
  setSsidDropdownOpen: (open: boolean) => void;
  deleteSavedTerm: (id: number, e: React.MouseEvent) => void;
  ssidInputRef: React.RefObject<HTMLInputElement | null>;
}

export const WigleNetworkFiltersCard: React.FC<WigleNetworkFiltersCardProps> = ({
  searchType,
  searchParams,
  setSearchParams,
  btParams,
  setBtParams,
  savedTerms,
  ssidDropdownOpen,
  setSsidDropdownOpen,
  deleteSavedTerm,
  ssidInputRef,
}) => {
  return (
    <>
      {/* Network Filters | Geographic Filters — 2-column */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {searchType === 'wifi' ? (
          <AdminCard
            icon={DatabaseIcon}
            title="Network Filters"
            color="from-blue-500 to-blue-600"
            compact
          >
            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <label className="block text-xs text-slate-400 mb-1">SSID</label>
                <input
                  ref={ssidInputRef}
                  type="text"
                  value={searchParams.ssid}
                  onChange={(e) => setSearchParams({ ...searchParams, ssid: e.target.value })}
                  onFocus={() => setSsidDropdownOpen(true)}
                  onBlur={() => setTimeout(() => setSsidDropdownOpen(false), 150)}
                  placeholder="Network name"
                  className="w-full px-2 py-1.5 bg-slate-800/50 border border-slate-600/60 rounded text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
                {ssidDropdownOpen && savedTerms.length > 0 && (
                  <div className="absolute z-20 top-full left-0 right-0 mt-0.5 bg-slate-800 border border-slate-600/60 rounded shadow-xl max-h-48 overflow-y-auto">
                    {savedTerms.map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between px-2 py-1.5 hover:bg-slate-700/60 cursor-pointer group"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setSearchParams({ ...searchParams, ssid: t.term });
                          setSsidDropdownOpen(false);
                        }}
                      >
                        <span className="text-xs text-slate-200 truncate">{t.term}</span>
                        <button
                          type="button"
                          onMouseDown={(e) => deleteSavedTerm(t.id, e)}
                          className="ml-2 text-slate-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 text-[10px] leading-none shrink-0"
                          title="Remove saved term"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">BSSID</label>
                <input
                  type="text"
                  value={searchParams.bssid}
                  onChange={(e) => setSearchParams({ ...searchParams, bssid: e.target.value })}
                  placeholder="AA:BB:CC:DD:EE:FF"
                  className="w-full px-2 py-1.5 bg-slate-800/50 border border-slate-600/60 rounded text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
              </div>
            </div>
          </AdminCard>
        ) : (
          <AdminCard
            icon={DatabaseIcon}
            title="BT / BLE Filters"
            color="from-purple-500 to-purple-600"
            compact
          >
            <div className="space-y-2">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Device Name</label>
                <input
                  type="text"
                  value={btParams.namelike}
                  onChange={(e) => setBtParams({ ...btParams, namelike: e.target.value })}
                  placeholder="Name wildcard (% = any)"
                  className="w-full px-2 py-1.5 bg-slate-800/50 border border-slate-600/60 rounded text-white text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Type</label>
                <div className="flex gap-3">
                  <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={btParams.showBt}
                      onChange={(e) => setBtParams({ ...btParams, showBt: e.target.checked })}
                      className="accent-purple-500"
                    />
                    BT
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={btParams.showBle}
                      onChange={(e) => setBtParams({ ...btParams, showBle: e.target.checked })}
                      className="accent-purple-500"
                    />
                    BLE
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Manufacturer Preset</label>
                <select
                  onChange={(e) => {
                    const idx = Number(e.target.value);
                    const preset = SURVEILLANCE_MFGR_PRESETS[idx];
                    if (preset && preset.min !== null) {
                      setBtParams({
                        ...btParams,
                        mfgrIdMinimum: String(preset.min),
                        mfgrIdMaximum: String(preset.max),
                      });
                    } else {
                      setBtParams({ ...btParams, mfgrIdMinimum: '', mfgrIdMaximum: '' });
                    }
                  }}
                  className="w-full px-2 py-1.5 bg-slate-800/50 border border-slate-600/60 rounded text-white text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                  defaultValue=""
                >
                  <option value="">Select known range…</option>
                  {SURVEILLANCE_MFGR_PRESETS.map((p, i) => (
                    <option key={i} value={i}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">mfgrId Min</label>
                  <input
                    type="number"
                    value={btParams.mfgrIdMinimum}
                    onChange={(e) => setBtParams({ ...btParams, mfgrIdMinimum: e.target.value })}
                    placeholder="e.g. 2504"
                    className="w-full px-2 py-1.5 bg-slate-800/50 border border-slate-600/60 rounded text-white text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">mfgrId Max</label>
                  <input
                    type="number"
                    value={btParams.mfgrIdMaximum}
                    onChange={(e) => setBtParams({ ...btParams, mfgrIdMaximum: e.target.value })}
                    placeholder="e.g. 2504"
                    className="w-full px-2 py-1.5 bg-slate-800/50 border border-slate-600/60 rounded text-white text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                  />
                </div>
              </div>
            </div>
          </AdminCard>
        )}

        <AdminCard
          icon={DatabaseIcon}
          title="Geographic Filters"
          color="from-indigo-500 to-indigo-600"
          compact
        >
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Country (ISO Code)</label>
                <input
                  type="text"
                  maxLength={2}
                  value={searchParams.country}
                  onChange={(e) => {
                    const clean = e.target.value
                      .replace(/[^a-zA-Z]/g, '')
                      .toUpperCase()
                      .slice(0, 2);
                    setSearchParams({ ...searchParams, country: clean });
                  }}
                  placeholder="US (2 letters)"
                  className="w-full px-2 py-1.5 bg-slate-800/50 border border-slate-600/60 rounded text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">State</label>
                <select
                  value={searchParams.region}
                  onChange={(e) => setSearchParams({ ...searchParams, region: e.target.value })}
                  className="w-full px-2 py-1.5 bg-slate-800/50 border border-slate-600/60 rounded text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                >
                  <option value="">Any</option>
                  {US_STATES.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.code} - {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">City</label>
              <input
                type="text"
                value={searchParams.city}
                onChange={(e) => setSearchParams({ ...searchParams, city: e.target.value })}
                placeholder="City name"
                className="w-full px-2 py-1.5 bg-slate-800/50 border border-slate-600/60 rounded text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              />
            </div>
          </div>
        </AdminCard>
      </div>

      {/* Coordinate Ranges — equal 2-column, Min/Max always side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Latitude Range */}
        <AdminCard
          icon={DatabaseIcon}
          title="Latitude Range"
          color="from-indigo-500 to-indigo-600"
          compact
        >
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Min</label>
              <input
                type="number"
                value={searchParams.latrange1}
                onChange={(e) => setSearchParams({ ...searchParams, latrange1: e.target.value })}
                placeholder="Min latitude"
                className="w-full px-2 py-1.5 bg-slate-800/50 border border-slate-600/60 rounded text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Max</label>
              <input
                type="number"
                value={searchParams.latrange2}
                onChange={(e) => setSearchParams({ ...searchParams, latrange2: e.target.value })}
                placeholder="Max latitude"
                className="w-full px-2 py-1.5 bg-slate-800/50 border border-slate-600/60 rounded text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              />
            </div>
          </div>
        </AdminCard>

        {/* Longitude Range */}
        <AdminCard
          icon={DatabaseIcon}
          title="Longitude Range"
          color="from-teal-500 to-teal-600"
          compact
        >
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Min</label>
              <input
                type="number"
                value={searchParams.longrange1}
                onChange={(e) => setSearchParams({ ...searchParams, longrange1: e.target.value })}
                placeholder="Min longitude"
                className="w-full px-2 py-1.5 bg-slate-800/50 border border-slate-600/60 rounded text-white text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/40"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Max</label>
              <input
                type="number"
                value={searchParams.longrange2}
                onChange={(e) => setSearchParams({ ...searchParams, longrange2: e.target.value })}
                placeholder="Max longitude"
                className="w-full px-2 py-1.5 bg-slate-800/50 border border-slate-600/60 rounded text-white text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/40"
              />
            </div>
          </div>
        </AdminCard>
      </div>
    </>
  );
};
