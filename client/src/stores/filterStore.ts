/**
 * Hardened Universal Filter Store with Per-Page Persistence
 * Single source of truth with page-scoped filter state
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { NetworkFilters, FilterState, TemporalScope } from '../types/filters';
import { logWarn } from '../logging/clientLogger';
import { buildFilterStateParams, parseFilterStateParams } from '../utils/filterUrlState';

interface PageFilterState {
  filters: NetworkFilters;
  enabled: Record<keyof NetworkFilters, boolean>;
}

interface HardenedFilterStore {
  // State - now page-scoped
  currentPage: string;
  pageStates: Record<string, PageFilterState>;
  boundingBoxViewportLocks: Record<string, boolean>;
  presets: Record<string, FilterState>;
  isLoading: boolean;
  lastAppliedFilters: any[];

  // Page management
  setCurrentPage: (pageName: string) => void;
  getCurrentFilters: () => NetworkFilters;
  getCurrentEnabled: () => Record<keyof NetworkFilters, boolean>;
  getBoundingBoxViewportLock: () => boolean;

  // Actions - operate on current page
  setFilter: <K extends keyof NetworkFilters>(key: K, value: NetworkFilters[K]) => void;
  toggleFilter: (key: keyof NetworkFilters) => void;
  enableFilter: (key: keyof NetworkFilters, enabled: boolean) => void;
  setBoundingBoxViewportLock: (locked: boolean) => void;
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
  has_notes: undefined,
  tag_type: [],
  wigle_v3_observation_count_min: undefined,
  qualityFilter: 'all',
};

// EXPLICIT enable/disable - most filters DISABLED by default
const defaultEnabled: Record<keyof NetworkFilters, boolean> = {
  ssid: false,
  bssid: false,
  manufacturer: false,
  radioTypes: false,
  frequencyBands: false,
  channelMin: false,
  channelMax: false,
  rssiMin: false,
  rssiMax: false,
  encryptionTypes: false,
  securityFlags: false,
  timeframe: false,
  temporalScope: false,
  observationCountMin: false,
  observationCountMax: false,
  has_notes: false,
  tag_type: false,
  wigle_v3_observation_count_min: false,
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

const applyDataQualityDefaults = (pageState: PageFilterState): PageFilterState => ({
  filters: {
    ...pageState.filters,
    qualityFilter: pageState.filters.qualityFilter ?? defaultFilters.qualityFilter,
  },
  enabled: {
    ...pageState.enabled,
    qualityFilter: pageState.enabled.qualityFilter ?? defaultEnabled.qualityFilter,
  },
});

const createDefaultPageState = (): PageFilterState => ({
  filters: { ...defaultFilters },
  enabled: { ...defaultEnabled },
});

const DEFAULT_PAGE_STATE: PageFilterState = createDefaultPageState();

const normalizePageState = (pageState?: PageFilterState): PageFilterState => {
  if (!pageState) {
    return DEFAULT_PAGE_STATE;
  }

  const nextFilters =
    pageState.filters.qualityFilter === undefined
      ? { ...pageState.filters, qualityFilter: defaultFilters.qualityFilter }
      : pageState.filters;
  const nextEnabled =
    pageState.enabled.qualityFilter === undefined
      ? { ...pageState.enabled, qualityFilter: defaultEnabled.qualityFilter }
      : pageState.enabled;

  if (nextFilters === pageState.filters && nextEnabled === pageState.enabled) {
    return pageState;
  }

  return {
    filters: nextFilters,
    enabled: nextEnabled,
  };
};

const getPageState = (
  pageStates: Record<string, PageFilterState>,
  page: string
): PageFilterState => {
  return normalizePageState(pageStates[page]);
};

const ensurePageStateRecord = (
  pageStates: Record<string, PageFilterState>,
  page: string
): Record<string, PageFilterState> => {
  const normalized = normalizePageState(pageStates[page]);
  if (pageStates[page] === normalized) {
    return pageStates;
  }
  return {
    ...pageStates,
    [page]: normalized,
  };
};

export const useFilterStore = create<HardenedFilterStore>()(
  persist(
    (set, get) => ({
      currentPage: 'default',
      pageStates: {},
      boundingBoxViewportLocks: {},
      presets: {},
      isLoading: false,
      lastAppliedFilters: [],

      setCurrentPage: (pageName) => {
        set((state) => ({
          currentPage: pageName,
          pageStates: ensurePageStateRecord(state.pageStates, pageName),
        }));
      },

      getCurrentFilters: () => {
        const { pageStates, currentPage } = get();
        return getPageState(pageStates, currentPage).filters;
      },

      getCurrentEnabled: () => {
        const { pageStates, currentPage } = get();
        return getPageState(pageStates, currentPage).enabled;
      },

      getBoundingBoxViewportLock: () => {
        const { boundingBoxViewportLocks, currentPage } = get();
        return Boolean(boundingBoxViewportLocks[currentPage]);
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
        const nextEnabled = !pageState.enabled[key];
        let nextFilters = pageState.filters;

        // Initialize array-based filters to empty arrays when toggled ON
        if (nextEnabled) {
          if (key === 'radioTypes' && pageState.filters.radioTypes === undefined) {
            nextFilters = { ...pageState.filters, radioTypes: [] };
          }
          if (key === 'frequencyBands' && pageState.filters.frequencyBands === undefined) {
            nextFilters = { ...pageState.filters, frequencyBands: [] };
          }
          if (key === 'encryptionTypes' && pageState.filters.encryptionTypes === undefined) {
            nextFilters = { ...pageState.filters, encryptionTypes: [] };
          }
          if (key === 'securityFlags' && pageState.filters.securityFlags === undefined) {
            nextFilters = { ...pageState.filters, securityFlags: [] };
          }
          if (key === 'threatCategories' && pageState.filters.threatCategories === undefined) {
            nextFilters = { ...pageState.filters, threatCategories: [] };
          }
          if (key === 'tag_type' && pageState.filters.tag_type === undefined) {
            nextFilters = { ...pageState.filters, tag_type: [] };
          }
          if (key === 'gpsAccuracyMax' && pageState.filters.gpsAccuracyMax === undefined) {
            nextFilters = { ...pageState.filters, gpsAccuracyMax: 100 };
          }
          if (key === 'has_notes' && pageState.filters.has_notes === undefined) {
            nextFilters = { ...pageState.filters, has_notes: true };
          }
        }

        set({
          pageStates: {
            ...pageStates,
            [currentPage]: {
              ...pageState,
              filters: nextFilters,
              enabled: { ...pageState.enabled, [key]: nextEnabled },
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

      setBoundingBoxViewportLock: (locked) => {
        const { currentPage, boundingBoxViewportLocks } = get();
        set({
          boundingBoxViewportLocks: {
            ...boundingBoxViewportLocks,
            [currentPage]: locked,
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
        return buildFilterStateParams({
          filters: pageState.filters,
          enabled: pageState.enabled,
        });
      },

      setFromURLParams: (params) => {
        const parsedState = parseFilterStateParams(params);
        if (!parsedState) {
          return;
        }
        try {
          const { currentPage, pageStates } = get();
          set({
            pageStates: {
              ...pageStates,
              [currentPage]: {
                filters: { ...defaultFilters, ...parsedState.filters },
                enabled: { ...defaultEnabled, ...parsedState.enabled },
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
        if (
          currentEnabled.wigle_v3_observation_count_min &&
          currentFilters.wigle_v3_observation_count_min !== undefined &&
          currentFilters.wigle_v3_observation_count_min < 0
        ) {
          errors.push('WiGLE observation count minimum cannot be negative');
        }

        return errors;
      },
    }),
    {
      name: 'shadowcheck-filters-v2',
      version: 3,
      partialize: (state) => ({
        currentPage: state.currentPage,
        pageStates: state.pageStates,
        boundingBoxViewportLocks: state.boundingBoxViewportLocks,
        presets: state.presets,
      }),
      migrate: (persistedState: any) => {
        if (!persistedState || typeof persistedState !== 'object') return persistedState;

        const nextPageStates = Object.fromEntries(
          Object.entries((persistedState.pageStates as Record<string, PageFilterState>) || {}).map(
            ([page, pageState]) => [page, normalizePageState(pageState)]
          )
        );

        return {
          ...persistedState,
          pageStates: nextPageStates,
        };
      },
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
  // Subscribe to the entire filter state to get stable references
  const currentPage = useFilterStore((state) => state.currentPage);
  const pageStates = useFilterStore((state) => state.pageStates);
  const timeoutRef = useRef<NodeJS.Timeout>(undefined);
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      const pageState = pageStates[currentPage] || { filters: {}, enabled: {} };
      callbackRef.current({
        filters: pageState.filters || {},
        enabled: pageState.enabled || {},
      });
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [pageStates, currentPage, delay]);
};

export const useCurrentPageState = () =>
  useFilterStore((state) => getPageState(state.pageStates, state.currentPage));

export const useCurrentFilters = () => useCurrentPageState().filters;

export const useCurrentEnabled = () => useCurrentPageState().enabled;
