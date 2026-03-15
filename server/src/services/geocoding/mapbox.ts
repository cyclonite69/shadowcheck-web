/**
 * Mapbox Geocoding Provider
 */

import type { GeocodeMode, GeocodeResult } from './types';

const parseMapboxContext = (
  context?: Array<{ id?: string; text?: string; short_code?: string }>
) => {
  const data: { city?: string; state?: string; postal?: string; country?: string } = {};
  if (!context) return data;

  for (const item of context) {
    const id = item.id || '';
    if (id.startsWith('place.')) {
      data.city = item.text || data.city;
    } else if (id.startsWith('region.')) {
      const short = item.short_code?.split('-')[1]?.toUpperCase();
      data.state = short || item.text || data.state;
    } else if (id.startsWith('postcode.')) {
      data.postal = item.text || data.postal;
    } else if (id.startsWith('country.')) {
      data.country = item.text || data.country;
    }
  }

  return data;
};

export const mapboxReverse = async (
  lat: number,
  lon: number,
  mode: GeocodeMode,
  permanent: boolean,
  token?: string
): Promise<GeocodeResult> => {
  if (!token) {
    throw new Error('missing_key');
  }

  const types = mode === 'address-only' ? 'address' : 'poi,address';
  const limit = mode === 'address-only' ? 1 : 5;
  const permanentParam = permanent ? '&permanent=true' : '';
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lon},${lat}.json?access_token=${token}&types=${types}&limit=${limit}${permanentParam}`;

  const response = await fetch(url);
  if (response.status === 429) {
    throw new Error('rate_limit');
  }
  if (!response.ok) {
    return { ok: false };
  }
  const json = (await response.json()) as {
    features?: Array<{
      text?: string;
      place_name?: string;
      place_type?: string[];
      relevance?: number;
      properties?: { category?: string };
      context?: Array<{ id?: string; text?: string; short_code?: string }>;
    }>;
  };

  const features = json.features || [];
  if (!features.length) {
    return { ok: false, raw: json };
  }

  const poiFeature = features.find((f) => f.place_type?.includes('poi'));
  const addressFeature =
    features.find((f) => f.place_type?.includes('address')) || features[0] || poiFeature;
  const context = parseMapboxContext(addressFeature?.context || poiFeature?.context);

  return {
    ok: true,
    poiName: poiFeature?.text || null,
    poiCategory: poiFeature?.properties?.category || null,
    featureType: addressFeature?.place_type?.[0] || poiFeature?.place_type?.[0] || null,
    address: addressFeature?.place_name || poiFeature?.place_name || null,
    city: context.city || null,
    state: context.state || null,
    postal: context.postal || null,
    country: context.country || null,
    confidence: addressFeature?.relevance ?? poiFeature?.relevance ?? null,
    raw: json,
  };
};
