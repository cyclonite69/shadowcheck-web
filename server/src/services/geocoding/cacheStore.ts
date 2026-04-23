import {
  fetchRows,
  resetFailedAddressCandidates,
  seedAddressCandidates,
  upsertGeocodeCacheBatch,
} from './cacheDatabase';
import { getActivePendingPrecisions, loadCacheStats } from './cacheStats';
import {
  GEOCODABLE_OBSERVATION_PREDICATE,
  providerPriority,
  shouldReplaceAddressData,
  shouldSkipPoi,
} from './cacheUtils';

export type GeocodeCacheWrite = {
  row: any;
  provider: string;
  result: any;
  mode: any;
};

export {
  fetchRows,
  getActivePendingPrecisions,
  GEOCODABLE_OBSERVATION_PREDICATE,
  loadCacheStats,
  providerPriority,
  resetFailedAddressCandidates,
  seedAddressCandidates,
  shouldReplaceAddressData,
  shouldSkipPoi,
  upsertGeocodeCacheBatch,
};
