/**
 * Geocoding Providers
 * Consolidated provider functions
 */

import type { GeocodeResult } from './types';

const readFailurePayload = async (response: Response): Promise<unknown> => {
  const text = await response.text();
  if (!text) {
    return { status: response.status, statusText: response.statusText };
  }

  try {
    return JSON.parse(text);
  } catch {
    return {
      status: response.status,
      statusText: response.statusText,
      body: text,
    };
  }
};

export const nominatimReverse = async (lat: number, lon: number): Promise<GeocodeResult> => {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`;
  const response = await fetch(url, { headers: { 'User-Agent': 'ShadowCheck/1.0' } });
  if (response.status === 429) {
    throw new Error('rate_limit');
  }
  if (!response.ok) {
    return {
      ok: false,
      error: `HTTP ${response.status}`,
      raw: await readFailurePayload(response),
    };
  }

  const json = (await response.json()) as {
    display_name?: string;
    address?: Record<string, string>;
  };

  if (!json.display_name) {
    return { ok: false, raw: json };
  }

  const address = json.address || {};
  const city = address.city || address.town || address.village || address.hamlet || address.county;

  return {
    ok: true,
    address: json.display_name,
    city: city || null,
    state: address.state || null,
    postal: address.postcode || null,
    country: address.country || null,
    raw: json,
  };
};

export const overpassPoi = async (lat: number, lon: number): Promise<GeocodeResult> => {
  const query = `[out:json];(node(around:75,${lat},${lon})[name];way(around:75,${lat},${lon})[name];);out body 1;`;
  const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
  const response = await fetch(url);
  if (response.status === 429) {
    throw new Error('rate_limit');
  }
  if (!response.ok) {
    return {
      ok: false,
      error: `HTTP ${response.status}`,
      raw: await readFailurePayload(response),
    };
  }
  const json = (await response.json()) as {
    elements?: Array<{
      tags?: Record<string, string>;
    }>;
  };
  const element = json.elements?.[0];
  const tags = element?.tags || {};
  if (!tags.name) {
    return { ok: false, raw: json };
  }

  return {
    ok: true,
    poiName: tags.name || null,
    poiCategory:
      tags.amenity ||
      tags.shop ||
      tags.leisure ||
      tags.tourism ||
      tags.office ||
      tags.building ||
      null,
    featureType: tags.amenity || tags.shop || tags.leisure || tags.tourism || tags.office || null,
    raw: json,
  };
};

export const opencageReverse = async (
  lat: number,
  lon: number,
  key?: string
): Promise<GeocodeResult> => {
  if (!key) {
    throw new Error('missing_key');
  }
  const url = `https://api.opencagedata.com/geocode/v1/json?q=${lat}+${lon}&key=${key}&limit=1`;
  const response = await fetch(url);
  if (response.status === 429) {
    throw new Error('rate_limit');
  }
  if (!response.ok) {
    return {
      ok: false,
      error: `HTTP ${response.status}`,
      raw: await readFailurePayload(response),
    };
  }
  const json = (await response.json()) as {
    results?: Array<{
      formatted?: string;
      components?: Record<string, string>;
      confidence?: number;
    }>;
  };
  const result = json.results?.[0];
  if (!result?.formatted) {
    return { ok: false, raw: json };
  }
  const components = result.components || {};
  return {
    ok: true,
    address: result.formatted,
    city:
      components.city ||
      components.town ||
      components.village ||
      components.hamlet ||
      components.county ||
      null,
    state: components.state || null,
    postal: components.postcode || null,
    country: components.country || null,
    confidence: result.confidence ? result.confidence / 100 : null,
    raw: json,
  };
};

export const geocodioReverse = async (
  lat: number,
  lon: number,
  key?: string
): Promise<GeocodeResult> => {
  if (!key) {
    throw new Error('missing_key');
  }
  const url = `https://api.geocod.io/v1.7/reverse?q=${lat},${lon}&api_key=${key}&limit=1`;
  const response = await fetch(url);
  if (response.status === 429) {
    throw new Error('rate_limit');
  }
  if (!response.ok) {
    return {
      ok: false,
      error: `HTTP ${response.status}`,
      raw: await readFailurePayload(response),
    };
  }
  const json = (await response.json()) as {
    results?: Array<{
      formatted_address?: string;
      address_components?: Record<string, string>;
      accuracy?: number;
    }>;
  };
  const result = json.results?.[0];
  if (!result?.formatted_address) {
    return { ok: false, raw: json };
  }
  const components = result.address_components || {};
  return {
    ok: true,
    address: result.formatted_address,
    city: components.city || components.county || components.place || components.locality || null,
    state: components.state || null,
    postal: components.zip || null,
    country: components.country || null,
    confidence: typeof result.accuracy === 'number' ? result.accuracy : null,
    raw: json,
  };
};

export const locationIqReverse = async (
  lat: number,
  lon: number,
  key?: string
): Promise<GeocodeResult> => {
  if (!key) {
    throw new Error('missing_key');
  }
  const url = `https://us1.locationiq.com/v1/reverse.php?key=${key}&lat=${lat}&lon=${lon}&format=json`;
  const response = await fetch(url);
  if (response.status === 429) {
    throw new Error('rate_limit');
  }
  if (!response.ok) {
    return {
      ok: false,
      error: `HTTP ${response.status}`,
      raw: await readFailurePayload(response),
    };
  }
  const json = (await response.json()) as {
    display_name?: string;
    address?: Record<string, string>;
    importance?: number;
  };
  if (!json.display_name) {
    return { ok: false, raw: json };
  }
  const address = json.address || {};
  return {
    ok: true,
    address: json.display_name,
    city:
      address.city || address.town || address.village || address.hamlet || address.county || null,
    state: address.state || null,
    postal: address.postcode || null,
    country: address.country || null,
    confidence: typeof json.importance === 'number' ? json.importance : null,
    raw: json,
  };
};
