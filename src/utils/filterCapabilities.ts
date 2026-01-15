/**
 * Universal Filter Capability System
 * Declares what filters each page supports and adapts canonical filters accordingly
 */

import { NetworkFilters } from '../types/filters';

export type FilterKey = keyof NetworkFilters;

/**
 * Page filter capabilities - declares which filters a page can consume
 */
export interface PageFilterCapabilities {
  /** Filters this page supports */
  supported: Partial<Record<FilterKey, boolean>>;
  /** Optional: page-specific notes about filter behavior */
  notes?: string;
}

/**
 * Result of adapting canonical filters to page capabilities
 */
export interface AdaptedFilters {
  /** Filters the page can use (only supported keys) */
  filtersForPage: Partial<NetworkFilters>;
  /** Enabled flags for supported filters */
  enabledForPage: Partial<Record<FilterKey, boolean>>;
  /** Filters that are active but not supported by this page */
  ignoredFilters: Array<{ key: FilterKey; value: any }>;
  /** Count of ignored filters */
  ignoredCount: number;
}

/**
 * Adapt canonical filters to page capabilities
 * Returns only supported filters, tracks ignored ones
 */
export function adaptFiltersToPage(
  filters: NetworkFilters,
  enabled: Record<FilterKey, boolean>,
  capabilities: PageFilterCapabilities
): AdaptedFilters {
  const filtersForPage: Partial<NetworkFilters> = {};
  const enabledForPage: Partial<Record<FilterKey, boolean>> = {};
  const ignoredFilters: Array<{ key: FilterKey; value: any }> = [];

  // Iterate through all enabled filters
  Object.keys(enabled).forEach((key) => {
    const filterKey = key as FilterKey;
    const isEnabled = enabled[filterKey];
    const isSupported = capabilities.supported[filterKey] === true;

    if (isEnabled && filters[filterKey] !== undefined) {
      if (isSupported) {
        // Include in page filters
        filtersForPage[filterKey] = filters[filterKey];
        enabledForPage[filterKey] = true;
      } else {
        // Track as ignored
        ignoredFilters.push({
          key: filterKey,
          value: filters[filterKey],
        });
      }
    }
  });

  return {
    filtersForPage,
    enabledForPage,
    ignoredFilters,
    ignoredCount: ignoredFilters.length,
  };
}

/**
 * Helper to create a "support all" capability (for pages that handle all filters)
 */
export function createFullCapabilities(): PageFilterCapabilities {
  return {
    supported: {
      ssid: true,
      bssid: true,
      manufacturer: true,
      networkId: true,
      radioTypes: true,
      frequencyBands: true,
      channelMin: true,
      channelMax: true,
      rssiMin: true,
      rssiMax: true,
      encryptionTypes: true,
      authMethods: true,
      insecureFlags: true,
      securityFlags: true,
      timeframe: true,
      temporalScope: true,
      observationCountMin: true,
      observationCountMax: true,
      gpsAccuracyMax: true,
      excludeInvalidCoords: true,
      qualityFilter: true,
      distanceFromHomeMin: true,
      distanceFromHomeMax: true,
      boundingBox: true,
      radiusFilter: true,
      threatScoreMin: true,
      threatScoreMax: true,
      threatCategories: true,
      stationaryConfidenceMin: true,
      stationaryConfidenceMax: true,
    },
  };
}

/**
 * Helper to create basic capabilities (common filters most pages support)
 */
export function createBasicCapabilities(): PageFilterCapabilities {
  return {
    supported: {
      ssid: true,
      bssid: true,
      radioTypes: true,
      rssiMin: true,
      rssiMax: true,
      timeframe: true,
      encryptionTypes: true,
    },
    notes: 'Basic filtering support',
  };
}

/**
 * Page capability registry
 * Each page declares its filter support here
 */
export const PAGE_CAPABILITIES: Record<string, PageFilterCapabilities> = {
  // Geospatial Explorer - full support
  geospatial: createFullCapabilities(),

  // Analytics - full support
  analytics: createFullCapabilities(),

  // Dashboard - basic support (aggregated data)
  dashboard: {
    supported: {
      radioTypes: true,
      timeframe: true,
      threatScoreMin: true,
      threatScoreMax: true,
      encryptionTypes: true,
      securityFlags: true,
    },
    notes: 'Dashboard shows aggregated metrics',
  },

  // Kepler test - visualization support
  kepler: {
    supported: {
      ssid: true,
      bssid: true,
      radioTypes: true,
      rssiMin: true,
      rssiMax: true,
      timeframe: true,
      encryptionTypes: true,
      threatScoreMin: true,
      threatScoreMax: true,
      boundingBox: true,
    },
    notes: 'Kepler visualization with spatial filters',
  },

  // WiGLE test - basic support
  wigle: {
    supported: {
      ssid: true,
      bssid: true,
      radioTypes: true,
      rssiMin: true,
      timeframe: true,
      encryptionTypes: true,
    },
    notes: 'WiGLE data comparison',
  },
};

/**
 * Get capabilities for a page by name
 */
export function getPageCapabilities(pageName: string): PageFilterCapabilities {
  return PAGE_CAPABILITIES[pageName] || createBasicCapabilities();
}
