import { useState, useEffect, useCallback } from 'react';
import { useFilterStore, useDebouncedFilters } from '../stores/filterStore';
import { logDebug } from '../logging/clientLogger';
import type { NetworkRow, ThreatInfo, SortState } from '../types/network';
import { API_SORT_MAP, NETWORK_PAGE_LIMIT } from '../constants/network';

// Format security capabilities string
const formatSecurity = (capabilities: string | null | undefined, fallback?: string | null) => {
  const value = String(capabilities || '').toUpperCase();
  if (!value || value === 'UNKNOWN') {
    return fallback || 'Open';
  }
  const hasWpa3 = value.includes('WPA3');
  const hasWpa2 = value.includes('WPA2');
  const hasWpa = value.includes('WPA');
  const hasWep = value.includes('WEP');
  const hasPsk = value.includes('PSK');
  const hasEap = value.includes('EAP');
  const hasSae = value.includes('SAE');
  const hasOwe = value.includes('OWE');

  if (hasOwe) return 'OWE';
  if (hasWpa3 && hasSae) return 'WPA3-SAE';
  if (hasWpa3 && hasEap) return 'WPA3-EAP';
  if (hasWpa3) return 'WPA3';
  if (hasWpa2 && hasEap) return 'WPA2-EAP';
  if (hasWpa2 && hasPsk) return 'WPA2-PSK';
  if (hasWpa2) return 'WPA2';
  if (hasWpa && hasEap) return 'WPA-EAP';
  if (hasWpa && hasPsk) return 'WPA-PSK';
  if (hasWpa) return 'WPA';
  if (hasWep) return 'WEP';
  return fallback || 'Open';
};

// Calculate WiFi channel from frequency
const calculateChannel = (freq: number | null): number | null => {
  if (!freq || typeof freq !== 'number') return null;

  // 2.4GHz channels (1-14)
  if (freq >= 2412 && freq <= 2484) {
    if (freq === 2484) return 14;
    return Math.floor((freq - 2412) / 5) + 1;
  }

  // 5GHz channels
  if (freq >= 5000 && freq <= 5900) {
    return Math.floor((freq - 5000) / 5);
  }

  // 6GHz channels
  if (freq >= 5925 && freq <= 7125) {
    return Math.floor((freq - 5925) / 5);
  }

  return null;
};

// Infer network type from available data
const inferNetworkType = (
  dbType: string | null,
  frequency: number | null,
  ssid: string | null,
  capabilities: string | null
): NetworkRow['type'] => {
  if (dbType && dbType !== '?' && dbType !== 'Unknown' && dbType !== null) {
    return dbType as NetworkRow['type'];
  }

  const ssidUpper = String(ssid || '').toUpperCase();
  const capUpper = String(capabilities || '').toUpperCase();

  // Frequency-based inference (most reliable)
  if (frequency) {
    if (frequency >= 2412 && frequency <= 2484) return 'W';
    if (frequency >= 5000 && frequency <= 5900) return 'W';
    if (frequency >= 5925 && frequency <= 7125) return 'W';
  }

  // Capability-based inference
  if (
    capUpper.includes('WPA') ||
    capUpper.includes('WEP') ||
    capUpper.includes('WPS') ||
    capUpper.includes('RSN') ||
    capUpper.includes('ESS') ||
    capUpper.includes('CCMP') ||
    capUpper.includes('TKIP')
  ) {
    return 'W';
  }

  // SSID-based inference
  if (ssidUpper.includes('5G') || capUpper.includes('NR')) return 'N';
  if (ssidUpper.includes('LTE') || ssidUpper.includes('4G')) return 'L';
  if (ssidUpper.includes('BLUETOOTH') || capUpper.includes('BLUETOOTH')) {
    if (capUpper.includes('LOW ENERGY') || capUpper.includes('BLE')) return 'E';
    return 'B';
  }

  return '?';
};

// Calculate timespan in days
const calculateTimespan = (first: string | null, last: string | null): number | null => {
  if (!first || !last) return null;
  const firstDate = new Date(first);
  const lastDate = new Date(last);
  if (isNaN(firstDate.getTime()) || isNaN(lastDate.getTime())) return null;
  const diffMs = lastDate.getTime() - firstDate.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
};

// Parse threat info from API response
const parseThreatInfo = (threat: any, bssid: string): ThreatInfo => {
  if (threat === true) {
    return {
      score: 1,
      level: 'HIGH',
      summary: 'Signal above threat threshold',
    };
  } else if (threat && typeof threat === 'object') {
    const t = threat as {
      score?: number | string;
      level?: string;
      summary?: string;
      debug?: any;
    };
    const apiScore =
      typeof t.score === 'string' ? parseFloat(t.score) : typeof t.score === 'number' ? t.score : 0;

    return {
      score: apiScore / 100,
      level: (t.level || 'NONE') as 'NONE' | 'LOW' | 'MED' | 'HIGH',
      summary: t.summary || `Threat level: ${t.level || 'NONE'}`,
      debug: t.debug || undefined,
    };
  }

  return {
    score: 0,
    level: 'NONE',
    summary: 'No threat analysis available',
  };
};

// Map API row to NetworkRow
const mapApiRowToNetwork = (row: any, idx: number): NetworkRow => {
  const securityValue = formatSecurity(row.capabilities, row.security);
  const bssidValue = (row.bssid || `unknown-${idx}`).toString().toUpperCase();
  const frequency = typeof row.frequency === 'number' ? row.frequency : null;
  const networkType = inferNetworkType(row.type, frequency, row.ssid, row.capabilities);
  const isWiFi = networkType === 'W';

  // Build threat object from separate columns
  const threatScore = typeof row.final_threat_score === 'number' ? row.final_threat_score : 0;
  const threatLevel = row.final_threat_level || 'NONE';
  const threatInfo: ThreatInfo = {
    score: threatScore / 100,
    level: threatLevel as 'NONE' | 'LOW' | 'MED' | 'HIGH' | 'CRITICAL',
    summary: `Threat level: ${threatLevel}`,
    debug: {
      rule_score: row.rule_based_score ?? null,
      ml_score: row.ml_threat_score ?? null,
      model_version: row.model_version ?? null,
    },
  };

  const channelValue =
    typeof row.channel === 'number' ? row.channel : isWiFi ? calculateChannel(frequency) : null;

  return {
    bssid: bssidValue,
    ssid: row.ssid || '(hidden)',
    type: networkType,
    signal: typeof row.signal === 'number' ? row.signal : null,
    security: securityValue,
    frequency: frequency,
    channel: channelValue,
    observations: parseInt(String(row.obs_count || 0), 10),
    latitude: typeof row.lat === 'number' ? row.lat : null,
    longitude: typeof row.lon === 'number' ? row.lon : null,
    distanceFromHome:
      typeof row.distance_from_home_km === 'number' ? row.distance_from_home_km * 1000 : null,
    accuracy: typeof row.accuracy_meters === 'number' ? row.accuracy_meters : null,
    firstSeen: row.first_observed_at || null,
    lastSeen: row.last_observed_at || row.observed_at || null,
    timespanDays: calculateTimespan(row.first_observed_at, row.last_observed_at),
    threat: threatInfo,
    threat_score: threatScore,
    threat_level: threatLevel,
    threat_rule_score: row.rule_based_score ?? null,
    threat_ml_score: row.ml_threat_score ?? null,
    threat_ml_weight: null,
    threat_ml_boost: null,
    threatReasons: [],
    threatEvidence: [],
    stationaryConfidence:
      typeof row.stationary_confidence === 'number' ? row.stationary_confidence : null,
    manufacturer: row.manufacturer || null,
    min_altitude_m: typeof row.min_altitude_m === 'number' ? row.min_altitude_m : null,
    max_altitude_m: typeof row.max_altitude_m === 'number' ? row.max_altitude_m : null,
    altitude_span_m: typeof row.altitude_span_m === 'number' ? row.altitude_span_m : null,
    max_distance_meters:
      typeof row.max_distance_meters === 'number' ? row.max_distance_meters : null,
    last_altitude_m: typeof row.last_altitude_m === 'number' ? row.last_altitude_m : null,
    is_sentinel: typeof row.is_sentinel === 'boolean' ? row.is_sentinel : null,
    rawLatitude:
      typeof row.raw_lat === 'number' ? row.raw_lat : typeof row.lat === 'number' ? row.lat : null,
    rawLongitude:
      typeof row.raw_lon === 'number' ? row.raw_lon : typeof row.lon === 'number' ? row.lon : null,
  };
};

interface UseNetworkDataOptions {
  locationMode?: string;
  planCheck?: boolean;
}

interface UseNetworkDataReturn {
  networks: NetworkRow[];
  loading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  networkTotal: number | null;
  networkTruncated: boolean;
  expensiveSort: boolean;
  pagination: { offset: number; hasMore: boolean };
  sort: SortState[];
  setSort: React.Dispatch<React.SetStateAction<SortState[]>>;
  loadMore: () => void;
  resetNetworks: () => void;
  resetPagination: () => void;
}

export function useNetworkData(options: UseNetworkDataOptions = {}): UseNetworkDataReturn {
  const { locationMode = 'latest_observation', planCheck = false } = options;

  const [networks, setNetworks] = useState<NetworkRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [networkTotal, setNetworkTotal] = useState<number | null>(null);
  const [networkTruncated, setNetworkTruncated] = useState(false);
  const [expensiveSort, setExpensiveSort] = useState(false);
  const [pagination, setPagination] = useState({ offset: 0, hasMore: true });
  const [sort, setSort] = useState<SortState[]>([{ column: 'lastSeen', direction: 'desc' }]);

  const [debouncedFilterState, setDebouncedFilterState] = useState(() =>
    useFilterStore.getState().getAPIFilters()
  );
  useDebouncedFilters((payload) => setDebouncedFilterState(payload), 500);

  const loadMore = useCallback(() => {
    setPagination((prev) => ({ ...prev, offset: prev.offset + NETWORK_PAGE_LIMIT }));
  }, []);

  const resetNetworks = useCallback(() => {
    setNetworks([]);
    setPagination({ offset: 0, hasMore: true });
  }, []);

  const resetPagination = useCallback(() => {
    setPagination({ offset: 0, hasMore: true });
  }, []);

  // Derived state: loading more if pagination offset > 0 and loading
  const isLoadingMore = loading && pagination.offset > 0;

  // Fetch networks
  useEffect(() => {
    const controller = new AbortController();

    const fetchNetworks = async () => {
      setLoading(true);
      setError(null);
      setExpensiveSort(false);

      try {
        const sortKeys = sort
          .map((entry) => API_SORT_MAP[entry.column])
          .filter((value): value is string => Boolean(value));

        if (sortKeys.length !== sort.length) {
          setError('One or more sort columns are not supported by the API.');
          setLoading(false);
          return;
        }

        const params = new URLSearchParams({
          limit: String(NETWORK_PAGE_LIMIT),
          offset: String(pagination.offset),
          sort: sortKeys.join(','),
          order: sort.map((entry) => entry.direction.toUpperCase()).join(','),
        });
        params.set('location_mode', locationMode);

        if (planCheck) {
          params.set('planCheck', '1');
        }

        const { filters, enabled } = debouncedFilterState;

        // Apply filters
        if (enabled.ssid && filters.ssid) {
          params.set('ssid', String(filters.ssid));
        }
        if (enabled.bssid && filters.bssid) {
          params.set('bssid', String(filters.bssid));
        }
        if (
          enabled.radioTypes &&
          Array.isArray(filters.radioTypes) &&
          filters.radioTypes.length > 0
        ) {
          params.set('radioTypes', filters.radioTypes.join(','));
        }
        if (
          enabled.encryptionTypes &&
          Array.isArray(filters.encryptionTypes) &&
          filters.encryptionTypes.length > 0
        ) {
          params.set('encryptionTypes', filters.encryptionTypes.join(','));
        }
        if (
          enabled.authMethods &&
          Array.isArray(filters.authMethods) &&
          filters.authMethods.length > 0
        ) {
          params.set('authMethods', filters.authMethods.join(','));
        }
        if (
          enabled.insecureFlags &&
          Array.isArray(filters.insecureFlags) &&
          filters.insecureFlags.length > 0
        ) {
          params.set('insecureFlags', filters.insecureFlags.join(','));
        }
        if (
          enabled.securityFlags &&
          Array.isArray(filters.securityFlags) &&
          filters.securityFlags.length > 0
        ) {
          params.set('securityFlags', filters.securityFlags.join(','));
        }
        if (enabled.rssiMin && filters.rssiMin !== undefined) {
          params.set('min_signal', String(filters.rssiMin));
        }
        if (enabled.rssiMax && filters.rssiMax !== undefined) {
          params.set('max_signal', String(filters.rssiMax));
        }
        if (enabled.observationCountMin && filters.observationCountMin !== undefined) {
          params.set('min_obs_count', String(filters.observationCountMin));
        }
        if (enabled.observationCountMax && filters.observationCountMax !== undefined) {
          params.set('max_obs_count', String(filters.observationCountMax));
        }
        if (
          enabled.threatCategories &&
          Array.isArray(filters.threatCategories) &&
          filters.threatCategories.length > 0
        ) {
          params.set('threat_categories', JSON.stringify(filters.threatCategories));
        }

        const toFiniteNumber = (value: unknown) => {
          const parsed = typeof value === 'number' ? value : Number(value);
          return Number.isFinite(parsed) ? parsed : null;
        };

        const maxDistance = toFiniteNumber(filters.distanceFromHomeMax);
        if (enabled.distanceFromHomeMax && maxDistance !== null) {
          params.set('distance_from_home_km_max', String(maxDistance / 1000));
        }
        const minDistance = toFiniteNumber(filters.distanceFromHomeMin);
        if (enabled.distanceFromHomeMin && minDistance !== null) {
          params.set('distance_from_home_km_min', String(minDistance / 1000));
        }

        // Bounding box filter
        if (enabled.boundingBox && filters.boundingBox) {
          const { north, south, east, west } = filters.boundingBox;
          const minLat = toFiniteNumber(south);
          const maxLat = toFiniteNumber(north);
          const minLng = toFiniteNumber(west);
          const maxLng = toFiniteNumber(east);

          if (
            minLat !== null &&
            maxLat !== null &&
            minLng !== null &&
            maxLng !== null &&
            minLat >= -90 &&
            maxLat <= 90 &&
            minLat <= maxLat &&
            minLng >= -180 &&
            maxLng <= 180 &&
            minLng <= maxLng
          ) {
            params.set('bbox_min_lat', String(minLat));
            params.set('bbox_max_lat', String(maxLat));
            params.set('bbox_min_lng', String(minLng));
            params.set('bbox_max_lng', String(maxLng));
          }
        }

        // Radius filter
        if (enabled.radiusFilter && filters.radiusFilter) {
          const { latitude, longitude, radiusMeters } = filters.radiusFilter;
          const centerLat = toFiniteNumber(latitude);
          const centerLng = toFiniteNumber(longitude);
          const radius = toFiniteNumber(radiusMeters);

          if (
            centerLat !== null &&
            centerLng !== null &&
            radius !== null &&
            centerLat >= -90 &&
            centerLat <= 90 &&
            centerLng >= -180 &&
            centerLng <= 180 &&
            radius > 0
          ) {
            params.set('radius_center_lat', String(centerLat));
            params.set('radius_center_lng', String(centerLng));
            params.set('radius_meters', String(radius));
          }
        }

        // Live distance filters
        const liveState = useFilterStore.getState().getAPIFilters();
        const liveMaxDistance = toFiniteNumber(liveState.filters.distanceFromHomeMax);
        if (liveState.enabled.distanceFromHomeMax && liveMaxDistance !== null) {
          params.set('distance_from_home_km_max', String(liveMaxDistance / 1000));
        }
        const liveMinDistance = toFiniteNumber(liveState.filters.distanceFromHomeMin);
        if (liveState.enabled.distanceFromHomeMin && liveMinDistance !== null) {
          params.set('distance_from_home_km_min', String(liveMinDistance / 1000));
        }

        // Timeframe filter
        if (enabled.timeframe && filters.timeframe?.type === 'relative') {
          const window = filters.timeframe.relativeWindow || '30d';
          const unit = window.slice(-2) === 'mo' ? 'mo' : window.slice(-1);
          const value = parseInt(window.slice(0, unit === 'mo' ? -2 : -1), 10);
          if (!Number.isNaN(value)) {
            let ms;
            if (unit === 'h') {
              ms = value * 3600000; // hours
            } else if (unit === 'm') {
              ms = value * 60000; // minutes
            } else if (unit === 'mo') {
              ms = value * 30.44 * 86400000; // months (average 30.44 days)
            } else if (unit === 'y') {
              ms = value * 365 * 86400000; // years
            } else {
              ms = value * 86400000; // days (default)
            }
            const since = new Date(Date.now() - ms).toISOString();
            params.set('last_seen', since);
          }
        }

        const res = await fetch(`/api/networks?${params.toString()}`, {
          signal: controller.signal,
        });
        logDebug(`Networks response status: ${res.status}`);
        if (!res.ok) throw new Error(`networks ${res.status}`);

        const data = await res.json();
        const rows = data.networks || [];
        setExpensiveSort(Boolean(data.expensive_sort));
        setNetworkTotal(typeof data.total === 'number' ? data.total : null);
        setNetworkTruncated(Boolean(data.truncated));

        const mapped: NetworkRow[] = rows.map(mapApiRowToNetwork);

        if (pagination.offset === 0) {
          setNetworks(mapped);
        } else {
          setNetworks((prev) => [...prev, ...mapped]);
        }

        setPagination((prev) => ({
          ...prev,
          hasMore: mapped.length === NETWORK_PAGE_LIMIT,
        }));
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          setError(err.message);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchNetworks();
    return () => controller.abort();
  }, [
    pagination.offset,
    JSON.stringify(debouncedFilterState),
    JSON.stringify(sort),
    planCheck,
    locationMode,
  ]);

  return {
    networks,
    loading,
    isLoadingMore,
    error,
    setError,
    networkTotal,
    networkTruncated,
    expensiveSort,
    pagination,
    sort,
    setSort,
    loadMore,
    resetNetworks,
    resetPagination,
  };
}

export default useNetworkData;
