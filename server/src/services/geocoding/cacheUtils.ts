const { query } = require('../../config/database');
import type { GeocodeResult, GeocodeRow } from './types';

const GEOCODABLE_OBSERVATION_PREDICATE = `
  lat IS NOT NULL
  AND lon IS NOT NULL
  AND lat BETWEEN -90 AND 90
  AND lon BETWEEN -180 AND 180
  AND COALESCE(is_quality_filtered, false) = false
`;

const shouldSkipPoi = (address?: string | null): boolean => {
  if (!address) return false;
  const normalized = address.toLowerCase();
  return (
    normalized.includes('814 martin luther king') || normalized.includes('816 martin luther king')
  );
};

const providerPriority = (provider?: string | null): number => {
  const normalized = String(provider || '')
    .trim()
    .toLowerCase();
  switch (normalized) {
    case 'mapbox_v5_permanent':
      return 5;
    case 'mapbox_v5':
    case 'mapbox':
      return 4;
    case 'locationiq':
      return 3;
    case 'geocodio':
      return 2;
    case 'opencage':
      return 1;
    default:
      return 0;
  }
};

const shouldReplaceAddressData = (
  current: {
    ok?: boolean;
    address?: string | null;
    confidence?: number | null;
    provider?: string | null;
  },
  incoming: {
    ok?: boolean;
    address?: string | null;
    confidence?: number | null;
    provider?: string | null;
  }
): boolean => {
  if (!incoming?.ok || !incoming.address) return false;
  if (!current?.address) return true;

  const currentConfidence = Number(current.confidence ?? 0);
  const incomingConfidence = Number(incoming.confidence ?? 0);
  if (incomingConfidence >= currentConfidence + 0.1) return true;

  if (Math.abs(incomingConfidence - currentConfidence) <= 0.05) {
    return providerPriority(incoming.provider) > providerPriority(current.provider);
  }

  return false;
};

export {
  GEOCODABLE_OBSERVATION_PREDICATE,
  providerPriority,
  shouldReplaceAddressData,
  shouldSkipPoi,
};
