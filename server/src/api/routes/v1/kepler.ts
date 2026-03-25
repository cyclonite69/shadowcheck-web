export {};
import type { Request, Response } from 'express';
/**
 * Kepler Routes (v1)
 * Provides GeoJSON endpoints for Kepler.gl visualization
 */

const express = require('express');
const router = express.Router();
const { keplerService, filterQueryBuilder } = require('../../../config/container');
const { UniversalFilterQueryBuilder, validateFilterPayload } = filterQueryBuilder;
const logger = require('../../../logging/logger');
const { frequencyToChannel } = require('../../../utils/frequencyUtils');

interface KeplerNetworkRow {
  bssid: string | null;
  ssid: string | null;
  signal: number | null;
  lon: number | null;
  lat: number | null;
  first_seen: unknown;
  last_seen: unknown;
  observed_at: unknown;
  manufacturer: string | null;
  type: string | null;
  frequency: number | null;
  capabilities: string | null;
  last_altitude_m: number | null;
  accuracy_meters: number | null;
  observations: number | null;
  threat: { level?: string; score?: number } | null;
  distance_from_home_km: number | null;
  max_distance_meters: number | null;
  unique_days: number | null;
  first_observed_at: unknown;
  last_observed_at: unknown;
}
interface KeplerObsRow {
  bssid: string | null;
  ssid: string | null;
  level: number | null;
  lon: number | null;
  lat: number | null;
  time: unknown;
  manufacturer: string | null;
  radio_type: string | null;
  radio_frequency: number | null;
  radio_capabilities: string | null;
  device_id: string | null;
  source_tag: string | null;
  altitude: number | null;
  accuracy: number | null;
  threat_level: string | null;
  threat_score: number | null;
  distance_from_home_km: number | null;
}
interface KeplerBssidRow {
  bssid: string | null;
}

const parseJsonParam = (value: unknown, fallback: unknown, name: string) => {
  if (!value) {
    return fallback;
  }
  try {
    return JSON.parse(String(value));
  } catch {
    throw new Error(`Invalid JSON for ${name}`);
  }
};

const assertHomeExistsIfNeeded = async (
  enabled: Record<string, unknown> | null | undefined,
  res: Response
) => {
  if (!enabled?.distanceFromHomeMin && !enabled?.distanceFromHomeMax) {
    return true;
  }
  try {
    const exists = await keplerService.checkHomeLocationExists();
    if (!exists) {
      res.status(400).json({
        ok: false,
        error: 'Home location is required for distance filters.',
      });
      return false;
    }
    return true;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    res.status(400).json({
      ok: false,
      error: errMsg,
    });
    return false;
  }
};

/**
 * Infers radio type when not provided.
 * @param {string|null} radioType - Radio type from observation
 * @param {string|null} ssid - Network SSID
 * @param {number|string|null} frequency - Observed frequency
 * @param {string|null} capabilities - Capabilities string
 * @returns {string} Inferred radio type code
 */
function inferRadioType(
  radioType: string | null | undefined,
  ssid: string | null | undefined,
  frequency: string | number | null | undefined,
  capabilities: string | null | undefined
) {
  // If database has a valid radio_type, use it
  if (radioType && radioType !== '' && radioType !== null) {
    return radioType;
  }

  const ssidUpper = String(ssid || '').toUpperCase();
  const capUpper = String(capabilities || '').toUpperCase();

  // Check for 5G NR (New Radio)
  if (ssidUpper.includes('5G') || capUpper.includes('NR') || capUpper.includes('5G NR')) {
    return 'N';
  }

  // Check for LTE (4G)
  if (
    ssidUpper.includes('LTE') ||
    ssidUpper.includes('4G') ||
    capUpper.includes('LTE') ||
    capUpper.includes('EARFCN')
  ) {
    return 'L';
  }

  // Check for WCDMA (3G)
  if (
    ssidUpper.includes('WCDMA') ||
    ssidUpper.includes('3G') ||
    ssidUpper.includes('UMTS') ||
    capUpper.includes('WCDMA') ||
    capUpper.includes('UMTS') ||
    capUpper.includes('UARFCN')
  ) {
    return 'D';
  }

  // Check for GSM (2G)
  if (
    ssidUpper.includes('GSM') ||
    ssidUpper.includes('2G') ||
    capUpper.includes('GSM') ||
    capUpper.includes('ARFCN')
  ) {
    return 'G';
  }

  // Check for CDMA
  if (ssidUpper.includes('CDMA') || capUpper.includes('CDMA')) {
    return 'C';
  }

  // Check for generic cellular keywords
  const cellularKeywords = ['T-MOBILE', 'VERIZON', 'AT&T', 'ATT', 'SPRINT', 'CARRIER', '3GPP'];
  if (cellularKeywords.some((keyword) => ssidUpper.includes(keyword))) {
    return 'L'; // Default cellular to LTE
  }

  // Check for BLE (Bluetooth Low Energy)
  if (
    ssidUpper.includes('[UNKNOWN / SPOOFED RADIO]') ||
    ssidUpper.includes('BLE') ||
    ssidUpper.includes('BTLE') ||
    capUpper.includes('BLE') ||
    capUpper.includes('BTLE') ||
    capUpper.includes('BLUETOOTH LOW ENERGY')
  ) {
    return 'E';
  }

  // Check for Bluetooth Classic
  if (ssidUpper.includes('BLUETOOTH') || capUpper.includes('BLUETOOTH')) {
    if (!capUpper.includes('LOW ENERGY') && !capUpper.includes('BLE')) {
      return 'B';
    }
    return 'E'; // Default Bluetooth to BLE if ambiguous
  }

  // Check frequency ranges
  if (frequency) {
    const freq = parseInt(String(frequency), 10);

    // WiFi 2.4GHz band (2400-2500 MHz)
    if (freq >= 2412 && freq <= 2484) {
      return 'W';
    }

    // WiFi 5GHz band (5000-6000 MHz)
    if (freq >= 5000 && freq <= 5900) {
      return 'W';
    }

    // WiFi 6GHz band (5925-7125 MHz)
    if (freq >= 5925 && freq <= 7125) {
      return 'W';
    }
  }

  // Check capabilities for WiFi keywords
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

  // Unknown - don't default to WiFi
  return '?';
}

/**
 * GET /api/kepler/data
 * Returns latest observation per network for Kepler.gl.
 */
router.get('/kepler/data', async (req: Request, res: Response) => {
  try {
    const { limit: limitRaw, offset: offsetRaw } = req.query;
    const limit = limitRaw ? parseInt(String(limitRaw), 10) : null;
    const offset = offsetRaw ? parseInt(String(offsetRaw), 10) : 0;
    let filters = {};
    let enabled = {};
    try {
      filters = parseJsonParam(req.query.filters, {}, 'filters');
      enabled = parseJsonParam(req.query.enabled, {}, 'enabled');
    } catch (err) {
      return res
        .status(400)
        .json({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
    const { errors } = validateFilterPayload(filters, enabled);
    if (errors.length > 0) {
      return res.status(400).json({ ok: false, errors });
    }

    if (!(await assertHomeExistsIfNeeded(enabled, res))) {
      return;
    }

    const builder = new UniversalFilterQueryBuilder(filters, enabled);
    const { sql, params } = builder.buildNetworkListQuery({ limit, offset });

    const result = await keplerService.executeKeplerQuery(sql, params);

    const bssids = new Set((result.rows || []).map((r: KeplerBssidRow) => r.bssid).filter(Boolean));
    const actualCounts = {
      observations: result.rowCount || 0,
      networks: bssids.size,
    };

    const geojson = {
      type: 'FeatureCollection',
      actualCounts,
      features: (result.rows || [])
        .filter((row: KeplerNetworkRow) => row.lon !== null && row.lat !== null)
        .map((row: KeplerNetworkRow) => ({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [row.lon, row.lat],
          },
          properties: {
            bssid: row.bssid,
            ssid: row.ssid || 'Hidden Network',
            bestlevel: row.signal || 0,
            signal: row.signal || 0,
            level: row.signal || 0,
            first_seen: row.first_seen || row.observed_at,
            last_seen: row.last_seen || row.observed_at,
            timestamp: row.last_seen || row.observed_at,
            manufacturer: row.manufacturer || 'Unknown',
            device_type: 'Unknown',
            type: inferRadioType(row.type, row.ssid, row.frequency, row.capabilities),
            channel: frequencyToChannel(row.frequency),
            frequency: row.frequency || null,
            capabilities: row.capabilities || '',
            encryption: row.capabilities || 'Open/Unknown',
            altitude: row.last_altitude_m ?? null,
            accuracy: row.accuracy_meters ?? null,
            obs_count: row.observations || 0,
            // Threat data
            threat_level: row.threat?.level || null,
            threat_score: row.threat?.score || null,
            // Distance/spatial data
            distance_from_home: row.distance_from_home_km || null,
            max_distance_km: row.max_distance_meters ? row.max_distance_meters / 1000 : null,
          },
        })),
    };

    res.json(geojson);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`Kepler data error: ${msg}`, { error });
    res.status(500).json({ error: msg || 'Failed to fetch kepler data' });
  }
});

/**
 * GET /api/kepler/observations
 * Returns full observations dataset for Kepler.gl.
 */
router.get('/kepler/observations', async (req: Request, res: Response) => {
  try {
    let filters = {};
    let enabled = {};
    try {
      filters = parseJsonParam(req.query.filters, {}, 'filters');
      enabled = parseJsonParam(req.query.enabled, {}, 'enabled');
    } catch (err) {
      return res
        .status(400)
        .json({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
    const { errors } = validateFilterPayload(filters, enabled);
    if (errors.length > 0) {
      return res.status(400).json({ ok: false, errors });
    }

    if (!(await assertHomeExistsIfNeeded(enabled, res))) {
      return;
    }

    const limitRaw = req.query.limit;
    const limit = limitRaw ? parseInt(String(limitRaw), 10) : null;

    const builder = new UniversalFilterQueryBuilder(filters, enabled);
    const { sql, params } = builder.buildGeospatialQuery({ limit });

    const result = await keplerService.executeKeplerQuery(sql, params);

    const bssids = new Set((result.rows || []).map((r: KeplerBssidRow) => r.bssid).filter(Boolean));
    const actualCounts = {
      observations: result.rowCount || 0,
      networks: bssids.size,
    };

    const geojson = {
      type: 'FeatureCollection',
      actualCounts,
      features: (result.rows || [])
        .filter((row: KeplerObsRow) => row.lon !== null && row.lat !== null)
        .map((row: KeplerObsRow) => ({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [row.lon, row.lat],
          },
          properties: {
            bssid: row.bssid,
            ssid: row.ssid || 'Hidden Network',
            bestlevel: row.level || 0,
            signal: row.level || 0,
            first_seen: row.time,
            last_seen: row.time,
            timestamp: row.time,
            manufacturer: row.manufacturer || 'Unknown',
            device_type: 'Unknown',
            type: inferRadioType(
              row.radio_type,
              row.ssid,
              row.radio_frequency,
              row.radio_capabilities
            ),
            channel: frequencyToChannel(row.radio_frequency),
            frequency: row.radio_frequency || null,
            capabilities: row.radio_capabilities || '',
            encryption: row.radio_capabilities || 'Open/Unknown',
            device_id: row.device_id,
            source_tag: row.source_tag,
            altitude: row.altitude,
            accuracy: row.accuracy,
            // Threat data (from network lookup if available)
            threat_level: row.threat_level || null,
            threat_score: row.threat_score || null,
            distance_from_home: row.distance_from_home_km || null,
          },
        })),
    };

    res.json(geojson);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`Observations data error: ${msg}`, { error });
    res.status(500).json({ error: msg });
  }
});

/**
 * GET /api/kepler/networks
 * Returns trilaterated networks from access_points for Kepler.gl.
 */
router.get('/kepler/networks', async (req: Request, res: Response) => {
  try {
    let filters = {};
    let enabled = {};
    try {
      filters = parseJsonParam(req.query.filters, {}, 'filters');
      enabled = parseJsonParam(req.query.enabled, {}, 'enabled');
    } catch (err) {
      return res
        .status(400)
        .json({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
    const { errors } = validateFilterPayload(filters, enabled);
    if (errors.length > 0) {
      return res.status(400).json({ ok: false, errors });
    }

    if (!(await assertHomeExistsIfNeeded(enabled, res))) {
      return;
    }

    const { limit: limitRaw, offset: offsetRaw } = req.query;
    const limit = limitRaw ? parseInt(String(limitRaw), 10) : null;
    const offset = offsetRaw ? parseInt(String(offsetRaw), 10) : 0;

    const builder = new UniversalFilterQueryBuilder(filters, enabled);
    const { sql, params } = builder.buildNetworkListQuery({ limit, offset });

    const result = await keplerService.executeKeplerQuery(sql, params);

    const bssids = new Set((result.rows || []).map((r: KeplerBssidRow) => r.bssid).filter(Boolean));
    const actualCounts = {
      observations: result.rowCount || 0,
      networks: bssids.size,
    };

    const geojson = {
      type: 'FeatureCollection',
      actualCounts,
      features: (result.rows || [])
        .filter((row: KeplerNetworkRow) => row.lon !== null && row.lat !== null)
        .map((row: KeplerNetworkRow) => ({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [row.lon, row.lat],
          },
          properties: {
            bssid: row.bssid,
            ssid: row.ssid || 'Hidden Network',
            bestlevel: row.signal || 0,
            signal: row.signal || 0,
            level: row.signal || 0,
            first_seen: row.first_seen || row.first_observed_at,
            last_seen: row.last_seen || row.last_observed_at,
            timestamp: row.last_seen || row.last_observed_at,
            manufacturer: row.manufacturer || 'Unknown',
            device_type: 'Unknown',
            type: inferRadioType(row.type, row.ssid, row.frequency, row.capabilities),
            channel: frequencyToChannel(row.frequency),
            frequency: row.frequency || null,
            capabilities: row.capabilities || '',
            encryption: row.capabilities || 'Open/Unknown',
            altitude: row.last_altitude_m ?? null,
            accuracy: row.accuracy_meters ?? null,
            obs_count: row.observations || 0,
            observation_count: row.observations || 0,
            observations: row.observations || 0,
            // Threat data
            threat_level: row.threat?.level || null,
            threat_score: row.threat?.score || null,
            // Distance/spatial data
            distance_from_home: row.distance_from_home_km || null,
            max_distance_km: row.max_distance_meters ? row.max_distance_meters / 1000 : null,
            // Temporal data
            timespan_days:
              row.first_seen && row.last_seen
                ? Math.ceil(
                    ((new Date(row.last_seen as string) as any) -
                      (new Date(row.first_seen as string) as any)) /
                      86400000
                  )
                : null,
            unique_days: row.unique_days || null,
          },
        })),
    };

    res.json(geojson);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`Networks data error: ${msg}`, { error });
    res.status(500).json({ error: msg });
  }
});

module.exports = router;
