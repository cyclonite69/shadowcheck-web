import { query } from '../../config/database';
import type { GeocodeMode, GeocodeProvider, GeocodeRow } from './types';
import {
  upsertAddressSuccess,
  upsertAddressFailure,
  upsertPoiSuccess,
  upsertPoiFailure,
  insertNetworkRepresentativeCandidates,
  insertObservationCandidates,
  fetchPoiRows,
  fetchNonMapboxAddressRows,
  fetchMapboxAddressRows,
  resetFailedAddressAttempts,
} from '../../repositories/geocodingCacheRepository';

const upsertGeocodeCacheBatch = async (precision: number, entries: any[]): Promise<void> => {
  if (entries.length === 0) {
    return;
  }

  if (entries.some((entry) => entry.mode === 'both')) {
    throw new Error('Geocode mode "both" is not supported for cache writes');
  }

  for (const entry of entries) {
    const { row, provider, result, mode } = entry;

    if (mode === 'address-only') {
      if (result.ok) {
        await upsertAddressSuccess(query, precision, row, provider, result);
      } else {
        await upsertAddressFailure(query, precision, row, provider, result);
      }
      continue;
    }

    if (mode === 'poi-only') {
      if (result.ok) {
        await upsertPoiSuccess(query, precision, row, provider, result);
      } else {
        await upsertPoiFailure(query, precision, row, provider, result);
      }
      continue;
    }

    throw new Error(`Unsupported geocode mode: ${mode}`);
  }
};

const seedNetworkRepresentativeCandidates = async (targetCount: number): Promise<number> => {
  return insertNetworkRepresentativeCandidates(query, targetCount);
};

const seedAddressCandidates = async (precision: number, targetCount: number): Promise<number> => {
  const observationInserted = await insertObservationCandidates(query, precision, targetCount);
  if (precision !== 5) {
    return observationInserted;
  }

  const networkInserted = await seedNetworkRepresentativeCandidates(targetCount);
  return observationInserted + networkInserted;
};

const fetchRows = async (
  precision: number,
  limit: number,
  mode: GeocodeMode,
  provider: GeocodeProvider
): Promise<GeocodeRow[]> => {
  if (mode === 'poi-only') {
    return fetchPoiRows(query, precision, limit);
  }

  if (provider !== 'mapbox') {
    return fetchNonMapboxAddressRows(query, precision, limit);
  }

  return fetchMapboxAddressRows(query, precision, limit);
};

const resetFailedAddressCandidates = async (precision: number): Promise<number> => {
  return resetFailedAddressAttempts(query, precision);
};

export { upsertGeocodeCacheBatch, seedAddressCandidates, fetchRows, resetFailedAddressCandidates };
