/**
 * Hardened Universal Filter Store with Per-Page Persistence
 * Single source of truth with page-scoped filter state
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { NetworkFilters, FilterState, TemporalScope } from '../types/filters';
import { logWarn } from '../logging/clientLogger';

interface PageFilterState {
  filters: NetworkFilters;
  enabled: Record<keyof NetworkFilters, boolean>;
}

interface HardenedFilterStore {
  // State - now page-scoped
  currentPage: string;
  pageStates: Record<string, PageFilterState>;
  presets: Record<string, FilterState>;
  isLoading: boolean;
  lastAppliedFilters: any[];

  // Page management
  setCurrentPage: (pageName: string) => void;
  getCurrentFilters: () => NetworkFilters;
  getCurrentEnabled: () => Record<keyof NetworkFilters, boolean>;

  // Actions - operate on current page
  setFilter: <K extends keyof NetworkFilters>(key: K, value: NetworkFilters[K]) => void;
  toggleFilter: (key: keyof NetworkFilters) => void;
  enableFilter: (key: keyof NetworkFilters, enabled: boolean) => void;
  clearFilters: () => void;
  resetFilters: () => void;

  // Presets
  savePreset: (name: string) => void;
  loadPreset: (name: string) => void;
  deletePreset: (name: string) => void;

  // Serialization
  getFilterState: () => FilterState;
  setFilterState: (state: FilterState) => void;
  getURLParams: () => URLSearchParams;
  setFromURLParams: (params: URLSearchParams) => void;

  // API Integration
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
  temporalScope: TemporalScope.OBSERVATION_TIME,
  timeframe: {
    type: 'relative',
    relativeWindow: '30d',
  },
};

// EXPLICIT enable/disable - most filters DISABLED by default
const defaultEnabled: Record<keyof NetworkFilters, boolean> = {
  ssid: false,
  bssid: false,
  manufacturer: false,
  networkId: false,
  radioTypes: false,
  frequencyBands: false,
  channelMin: false,
  channelMax: false,
  rssiMin: false,
  rssiMax: false,
  encryptionTypes: false,
  authMethods: false,
  insecureFlags: false,
  securityFlags: false,
  timeframe: false,
  temporalScope: false,
  observationCountMin: false,
  observationCountMax: false,
  gpsAccuracyMax: false,
  excludeInvalidCoords: false,
  qualityFilter: false,
  distanceFromHomeMin: false,
  distanceFromHomeMax: false,
  boundingBox: false,
  radiusFilter: false,
  threatScoreMin: false,
  threatScoreMax: false,
  threatCategories: false,
  stationaryConfidenceMin: false,
  stationaryConfidenceMax: false,
};

const createDefaultPageState = (): PageFilterState => ({
  filters: defaultFilters,
  enabled: defaultEnabled,
});

const getPageState = (
  pageStates: Record<string, PageFilterState>,
  page: string
): PageFilterState => {
  if (!pageStates[page]) {
    return createDefaultPageState();
  }
  return pageStates[page];
};

export const useFilterStore = create<HardenedFilterStore>()(
  persist(
    (set, get) => ({
      currentPage: 'default',
      pageStates: {},
      presets: {},
      isLoading: false,
      lastAppliedFilters: [],

      setCurrentPage: (pageName) => {
        set({ currentPage: pageName });
      },

      getCurrentFilters: () => {
        const { pageStates, currentPage } = get();
        return getPageState(pageStates, currentPage).filters;
      },

      getCurrentEnabled: () => {
        const { pageStates, currentPage } = get();
        return getPageState(pageStates, currentPage).enabled;
      },

      setFilter: (key, value) => {
        const { currentPage, pageStates } = get();
        const pageState = getPageState(pageStates, currentPage);
        set({
          pageStates: {
            ...pageStates,
            [currentPage]: {
              filters: { ...pageState.filters, [key]: value },
              enabled: { ...pageState.enabled, [key]: true },
            },
          },
        });
      },

      toggleFilter: (key) => {
        const { currentPage, pageStates } = get();
        const pageState = getPageState(pageStates, currentPage);
        set({
          pageStates: {
            ...pageStates,
            [currentPage]: {
              ...pageState,
              enabled: { ...pageState.enabled, [key]: !pageState.enabled[key] },
            },
          },
        });
      },

      enableFilter: (key, enabled) => {
        const { currentPage, pageStates } = get();
        const pageState = getPageState(pageStates, currentPage);
        set({
          pageStates: {
            ...pageStates,
            [currentPage]: {
              ...pageState,
              enabled: { ...pageState.enabled, [key]: enabled },
            },
          },
        });
      },

      clearFilters: () => {
        const { currentPage, pageStates } = get();
        set({
          pageStates: {
            ...pageStates,
            [currentPage]: createDefaultPageState(),
          },
        });
      },

      resetFilters: () => {
        const { currentPage, pageStates } = get();
        set({
          pageStates: {
            ...pageStates,
            [currentPage]: createDefaultPageState(),
          },
        });
      },

      // Preset management
      savePreset: (name) => {
        const { currentPage, pageStates } = get();
        const pageState = getPageState(pageStates, currentPage);
        set((state) => ({
          presets: {
            ...state.presets,
            [name]: { filters: pageState.filters, enabled: pageState.enabled },
          },
        }));
      },

      loadPreset: (name) => {
        const { presets, currentPage, pageStates } = get();
        const preset = presets[name];
        if (preset) {
          set({
            pageStates: {
              ...pageStates,
              [currentPage]: {
                filters: preset.filters,
                enabled: preset.enabled,
              },
            },
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
        const { currentPage, pageStates } = get();
        const pageState = getPageState(pageStates, currentPage);
        return { filters: pageState.filters, enabled: pageState.enabled };
      },

      setFilterState: (state) => {
        const validationErrors = get().validateFilters(state.filters, state.enabled);
        if (validationErrors.length === 0) {
          const { currentPage, pageStates } = get();
          set({
            pageStates: {
              ...pageStates,
              [currentPage]: {
                filters: state.filters,
                enabled: state.enabled,
              },
            },
          });
        } else {
          logWarn('Invalid filter state', validationErrors);
        }
      },

      getURLParams: () => {
        const { currentPage, pageStates } = get();
        const pageState = getPageState(pageStates, currentPage);
        const params = new URLSearchParams();
        params.set('filters', JSON.stringify(pageState.filters));
        params.set('enabled', JSON.stringify(pageState.enabled));
        return params;
      },

      setFromURLParams: (params) => {
        const rawFilters = params.get('filters');
        const rawEnabled = params.get('enabled');

        // Skip if missing or invalid
        if (
          !rawFilters ||
          !rawEnabled ||
          rawFilters === 'undefined' ||
          rawEnabled === 'undefined'
        ) {
          return;
        }

        try {
          const parsedFilters = JSON.parse(rawFilters);
          const parsedEnabled = JSON.parse(rawEnabled);
          const { currentPage, pageStates } = get();
          set({
            pageStates: {
              ...pageStates,
              [currentPage]: {
                filters: { ...defaultFilters, ...parsedFilters },
                enabled: { ...defaultEnabled, ...parsedEnabled },
              },
            },
          });
        } catch (e) {
          logWarn('Failed to parse filter params', e);
        }
      },

      getAPIFilters: () => {
        const { currentPage, pageStates } = get();
        const pageState = getPageState(pageStates, currentPage);
        return { filters: pageState.filters, enabled: pageState.enabled };
      },

      setLoading: (loading) => {
        set({ isLoading: loading });
      },

      setLastAppliedFilters: (appliedFilters) => {
        set({ lastAppliedFilters: appliedFilters });
      },

      // Validation for forensic integrity
      validateFilters: (filters, enabled) => {
        const currentFilters = filters || get().getCurrentFilters();
        const currentEnabled = enabled || get().getCurrentEnabled();
        const errors: string[] = [];

        // RSSI validation
        if (
          currentEnabled.rssiMin &&
          currentFilters.rssiMin !== undefined &&
          currentFilters.rssiMin < -95
        ) {
          errors.push('RSSI minimum below noise floor (-95 dBm)');
        }
        if (
          currentEnabled.rssiMax &&
          currentFilters.rssiMax !== undefined &&
          currentFilters.rssiMax > 0
        ) {
          errors.push('RSSI maximum above 0 dBm (impossible)');
        }
        if (
          currentEnabled.rssiMin &&
          currentEnabled.rssiMax &&
          currentFilters.rssiMin !== undefined &&
          currentFilters.rssiMax !== undefined &&
          currentFilters.rssiMin > currentFilters.rssiMax
        ) {
          errors.push('RSSI minimum greater than maximum');
        }

        // GPS accuracy validation
        if (
          currentEnabled.gpsAccuracyMax &&
          currentFilters.gpsAccuracyMax !== undefined &&
          currentFilters.gpsAccuracyMax > 1000
        ) {
          errors.push('GPS accuracy limit too high (>1000m)');
        }

        // Threat score validation
        if (
          currentEnabled.threatScoreMin &&
          currentFilters.threatScoreMin !== undefined &&
          (currentFilters.threatScoreMin < 0 || currentFilters.threatScoreMin > 100)
        ) {
          errors.push('Threat score minimum out of range (0-100)');
        }
        if (
          currentEnabled.threatScoreMax &&
          currentFilters.threatScoreMax !== undefined &&
          (currentFilters.threatScoreMax < 0 || currentFilters.threatScoreMax > 100)
        ) {
          errors.push('Threat score maximum out of range (0-100)');
        }

        // Stationary confidence validation
        if (
          currentEnabled.stationaryConfidenceMin &&
          currentFilters.stationaryConfidenceMin !== undefined &&
          (currentFilters.stationaryConfidenceMin < 0 || currentFilters.stationaryConfidenceMin > 1)
        ) {
          errors.push('Stationary confidence minimum out of range (0.0-1.0)');
        }
        if (
          currentEnabled.stationaryConfidenceMax &&
          currentFilters.stationaryConfidenceMax !== undefined &&
          (currentFilters.stationaryConfidenceMax < 0 || currentFilters.stationaryConfidenceMax > 1)
        ) {
          errors.push('Stationary confidence maximum out of range (0.0-1.0)');
        }

        return errors;
      },
    }),
    {
      name: 'shadowcheck-filters-v2',
      partialize: (state) => ({
        currentPage: state.currentPage,
        pageStates: state.pageStates,
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
  // Use getCurrentFilters/getCurrentEnabled to get stable references
  const filters = useFilterStore((state) => state.getCurrentFilters());
  const enabled = useFilterStore((state) => state.getCurrentEnabled());
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      callback({ filters, enabled });
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [filters, enabled, callback, delay]);
};
