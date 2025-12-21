/**
 * Hardened Universal Filter Store
 * Single source of truth with explicit enable/disable and forensic integrity
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { NetworkFilters, FilterState, TemporalScope } from '../types/filters';

interface HardenedFilterStore {
  // State
  filters: NetworkFilters;
  enabled: Record<keyof NetworkFilters, boolean>;
  presets: Record<string, FilterState>;
  isLoading: boolean;
  lastAppliedFilters: any[]; // Track what filters were actually applied

  // Actions
  setFilter: <K extends keyof NetworkFilters>(key: K, value: NetworkFilters[K]) => void;
  toggleFilter: (key: keyof NetworkFilters) => void;
  enableFilter: (key: keyof NetworkFilters, enabled: boolean) => void;
  clearFilters: () => void;
  resetFilters: () => void;

  // Presets
  savePreset: (name: string) => void;
  loadPreset: (name: string) => void;
  deletePreset: (name: string) => void;

  // Serialization with validation
  getFilterState: () => FilterState;
  setFilterState: (state: FilterState) => void;
  getURLParams: () => URLSearchParams;
  setFromURLParams: (params: URLSearchParams) => void;

  // API Integration with transparency
  getAPIFilters: () => { filters: NetworkFilters; enabled: Record<keyof NetworkFilters, boolean> };
  setLoading: (loading: boolean) => void;
  setLastAppliedFilters: (appliedFilters: any[]) => void;

  // Validation
  validateFilters: (
    filters?: NetworkFilters,
    enabled?: Record<keyof NetworkFilters, boolean>
  ) => string[];
}

// Forensically correct defaults - NO implicit filtering
const defaultFilters: NetworkFilters = {
  // Temporal scope defaults to OBSERVATION_TIME, but is not applied unless enabled
  temporalScope: TemporalScope.OBSERVATION_TIME,
  timeframe: {
    type: 'relative',
    relativeWindow: '30d',
  },
};

// EXPLICIT enable/disable - most filters DISABLED by default
const defaultEnabled: Record<keyof NetworkFilters, boolean> = {
  // Identity - disabled by default
  ssid: false,
  bssid: false,
  manufacturer: false,
  networkId: false,

  // Radio - disabled by default
  radioTypes: false,
  frequencyBands: false,
  channelMin: false,
  channelMax: false,
  rssiMin: false,
  rssiMax: false,

  // Security - disabled by default
  encryptionTypes: false,
  authMethods: false,
  insecureFlags: false,
  securityFlags: false,

  // Temporal - disabled by default (no implicit filters)
  timeframe: false,
  temporalScope: false,

  // Observation Quality - DISABLED by default (credibility heuristics)
  observationCountMin: false, // CRITICAL: disabled to avoid excluding valid data
  observationCountMax: false,
  gpsAccuracyMax: false,
  excludeInvalidCoords: false,

  // Spatial - disabled by default
  distanceFromHomeMin: false,
  distanceFromHomeMax: false,
  boundingBox: false,
  radiusFilter: false,

  // Threat - disabled by default
  threatScoreMin: false,
  threatScoreMax: false,
  threatCategories: false,
  stationaryConfidenceMin: false,
  stationaryConfidenceMax: false,
};

export const useFilterStore = create<HardenedFilterStore>()(
  persist(
    (set, get) => ({
      filters: defaultFilters,
      enabled: defaultEnabled,
      presets: {},
      isLoading: false,
      lastAppliedFilters: [],

      setFilter: (key, value) => {
        set((state) => ({
          filters: { ...state.filters, [key]: value },
          enabled: { ...state.enabled, [key]: true },
        }));
      },

      toggleFilter: (key) => {
        set((state) => ({
          enabled: { ...state.enabled, [key]: !state.enabled[key] },
        }));
      },

      enableFilter: (key, enabled) => {
        set((state) => ({
          enabled: { ...state.enabled, [key]: enabled },
        }));
      },

      clearFilters: () => {
        set({
          filters: defaultFilters,
          enabled: Object.fromEntries(
            Object.keys(defaultEnabled).map((key) => [key, false])
          ) as Record<keyof NetworkFilters, boolean>,
        });
      },

      resetFilters: () => {
        set({
          filters: defaultFilters,
          enabled: defaultEnabled,
        });
      },

      // Preset management
      savePreset: (name) => {
        const { filters, enabled } = get();
        set((state) => ({
          presets: {
            ...state.presets,
            [name]: { filters, enabled },
          },
        }));
      },

      loadPreset: (name) => {
        const { presets } = get();
        const preset = presets[name];
        if (preset) {
          set({
            filters: preset.filters,
            enabled: preset.enabled,
          });
        }
      },

      deletePreset: (name) => {
        set((state) => {
          const { [name]: deleted, ...remaining } = state.presets;
          return { presets: remaining };
        });
      },

      getFilterState: () => {
        const { filters, enabled } = get();
        return { filters, enabled };
      },

      setFilterState: (state) => {
        // Validate state before setting
        const validationErrors = get().validateFilters(state.filters, state.enabled);
        if (validationErrors.length === 0) {
          set({
            filters: state.filters,
            enabled: state.enabled,
          });
        } else {
          console.warn('Invalid filter state:', validationErrors);
        }
      },

      getURLParams: () => {
        const { filters, enabled } = get();
        const params = new URLSearchParams();
        params.set('filters', JSON.stringify(filters));
        params.set('enabled', JSON.stringify(enabled));
        return params;
      },

      setFromURLParams: (params) => {
        const rawFilters = params.get('filters');
        const rawEnabled = params.get('enabled');
        if (!rawFilters || !rawEnabled) {
          return;
        }
        try {
          const parsedFilters = JSON.parse(rawFilters);
          const parsedEnabled = JSON.parse(rawEnabled);
          set({
            filters: { ...defaultFilters, ...parsedFilters },
            enabled: { ...defaultEnabled, ...parsedEnabled },
          });
        } catch (e) {
          console.warn('Failed to parse filter params:', e);
        }
      },

      getAPIFilters: () => {
        const { filters, enabled } = get();
        return { filters, enabled };
      },

      setLoading: (loading) => {
        set({ isLoading: loading });
      },

      setLastAppliedFilters: (appliedFilters) => {
        set({ lastAppliedFilters: appliedFilters });
      },

      // Validation for forensic integrity
      validateFilters: (filters = get().filters, enabled = get().enabled) => {
        const errors: string[] = [];

        // RSSI validation
        if (enabled.rssiMin && filters.rssiMin !== undefined && filters.rssiMin < -95) {
          errors.push('RSSI minimum below noise floor (-95 dBm)');
        }
        if (enabled.rssiMax && filters.rssiMax !== undefined && filters.rssiMax > 0) {
          errors.push('RSSI maximum above 0 dBm (impossible)');
        }
        if (
          enabled.rssiMin &&
          enabled.rssiMax &&
          filters.rssiMin !== undefined &&
          filters.rssiMax !== undefined &&
          filters.rssiMin > filters.rssiMax
        ) {
          errors.push('RSSI minimum greater than maximum');
        }

        // GPS accuracy validation
        if (
          enabled.gpsAccuracyMax &&
          filters.gpsAccuracyMax !== undefined &&
          filters.gpsAccuracyMax > 1000
        ) {
          errors.push('GPS accuracy limit too high (>1000m)');
        }

        // Threat score validation
        if (
          enabled.threatScoreMin &&
          filters.threatScoreMin !== undefined &&
          (filters.threatScoreMin < 0 || filters.threatScoreMin > 100)
        ) {
          errors.push('Threat score minimum out of range (0-100)');
        }
        if (
          enabled.threatScoreMax &&
          filters.threatScoreMax !== undefined &&
          (filters.threatScoreMax < 0 || filters.threatScoreMax > 100)
        ) {
          errors.push('Threat score maximum out of range (0-100)');
        }

        // Stationary confidence validation
        if (
          enabled.stationaryConfidenceMin &&
          filters.stationaryConfidenceMin !== undefined &&
          (filters.stationaryConfidenceMin < 0 || filters.stationaryConfidenceMin > 1)
        ) {
          errors.push('Stationary confidence minimum out of range (0.0-1.0)');
        }
        if (
          enabled.stationaryConfidenceMax &&
          filters.stationaryConfidenceMax !== undefined &&
          (filters.stationaryConfidenceMax < 0 || filters.stationaryConfidenceMax > 1)
        ) {
          errors.push('Stationary confidence maximum out of range (0.0-1.0)');
        }

        return errors;
      },
    }),
    {
      name: 'shadowcheck-hardened-filters',
      partialize: (state) => ({
        filters: state.filters,
        enabled: state.enabled,
        presets: state.presets,
      }),
    }
  )
);

// Debounced filter hook for API calls
import { useEffect, useRef } from 'react';

export const useDebouncedFilters = (
  callback: (payload: {
    filters: NetworkFilters;
    enabled: Record<keyof NetworkFilters, boolean>;
  }) => void,
  delay = 500
) => {
  const filters = useFilterStore((state) => state.getAPIFilters());
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      callback(filters);
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [filters, callback, delay]);
};
