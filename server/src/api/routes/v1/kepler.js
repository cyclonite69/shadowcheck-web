/**
 * Kepler Routes (v1)
 * Provides GeoJSON endpoints for Kepler.gl visualization
 */

const express = require('express');
const router = express.Router();
const { query } = require('../../../config/database');
const logger = require('../../../logging/logger');

/**
 * Infers radio type when not provided.
 * @param {string|null} radioType - Radio type from observation
 * @param {string|null} ssid - Network SSID
 * @param {number|string|null} frequency - Observed frequency
 * @param {string|null} capabilities - Capabilities string
 * @returns {string} Inferred radio type code
 */
function inferRadioType(radioType, ssid, frequency, capabilities) {
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
    const freq = parseInt(frequency, 10);

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
router.get('/kepler/data', async (req, res) => {
  try {
    const { _bbox, limit: limitRaw } = req.query;
    const limit = limitRaw ? Math.min(parseInt(limitRaw, 10) || 5000, 50000) : 5000;

    // Get latest observation per network (similar to networks endpoint but simpler)
    const result = await query(
      `
      WITH obs_latest AS (
        SELECT DISTINCT ON (bssid)
          bssid,
          ssid,
          lat,
          lon,
          level,
          accuracy,
          time AS observed_at,
          radio_type,
          radio_frequency,
          radio_capabilities
        FROM public.observations
        WHERE lat IS NOT NULL AND lon IS NOT NULL
        ORDER BY bssid, time DESC
      )
      SELECT
        obs.bssid,
        obs.ssid,
        obs.lat,
        obs.lon,
        obs.level,
        obs.accuracy,
        obs.observed_at,
        obs.radio_frequency AS frequency,
        obs.radio_capabilities AS capabilities,
        obs.radio_type AS type,
        COALESCE(ap.total_observations, 1) AS observations,
        ap.first_seen,
        ap.last_seen
      FROM obs_latest obs
      LEFT JOIN public.access_points ap ON ap.bssid = obs.bssid
      WHERE obs.lat IS NOT NULL AND obs.lon IS NOT NULL
      ORDER BY obs.observed_at DESC
      LIMIT $1
    `,
      [limit]
    );

    const geojson = {
      type: 'FeatureCollection',
      features: result.rows.map((row) => ({
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
          level: row.level || 0,
          first_seen: row.first_seen || row.observed_at,
          last_seen: row.last_seen || row.observed_at,
          timestamp: row.last_seen || row.observed_at,
          manufacturer: 'Unknown',
          device_type: 'Unknown',
          type: inferRadioType(row.type, row.ssid, row.frequency, row.capabilities),
          channel: row.frequency ? Math.floor((row.frequency - 2407) / 5) : null,
          frequency: row.frequency || null,
          capabilities: row.capabilities || '',
          encryption: row.capabilities || 'Open/Unknown',
          altitude: null,
          accuracy: row.accuracy,
          obs_count: row.observations || 0,
        },
      })),
    };

    res.json(geojson);
  } catch (error) {
    logger.error(`Kepler data error: ${error.message}`, { error });
    res.status(500).json({ error: error.message || 'Failed to fetch kepler data' });
  }
});

/**
 * GET /api/kepler/observations
 * Returns full observations dataset for Kepler.gl.
 */
router.get('/kepler/observations', async (req, res) => {
  try {
    const { filters, enabled } = req.query;

    let whereClause = 'WHERE geom IS NOT NULL';
    const queryParams = [];
    let paramIndex = 1;

    // Apply filters if provided
    if (filters && enabled) {
      try {
        const filterObj = JSON.parse(filters);
        const enabledObj = JSON.parse(enabled);

        // SSID filter
        if (enabledObj.ssid && filterObj.ssid) {
          whereClause += ` AND ssid ILIKE $${paramIndex}`;
          queryParams.push(`%${filterObj.ssid}%`);
          paramIndex++;
        }

        // BSSID filter
        if (enabledObj.bssid && filterObj.bssid) {
          whereClause += ` AND bssid ILIKE $${paramIndex}`;
          queryParams.push(`${filterObj.bssid}%`);
          paramIndex++;
        }

        // Radio Types filter
        if (enabledObj.radioTypes && filterObj.radioTypes && filterObj.radioTypes.length > 0) {
          whereClause += ` AND radio_type = ANY($${paramIndex})`;
          queryParams.push(filterObj.radioTypes);
          paramIndex++;
        }

        // RSSI filters
        if (enabledObj.rssiMin && filterObj.rssiMin !== undefined) {
          whereClause += ` AND level >= $${paramIndex}`;
          queryParams.push(filterObj.rssiMin);
          paramIndex++;
        }

        if (enabledObj.rssiMax && filterObj.rssiMax !== undefined) {
          whereClause += ` AND level <= $${paramIndex}`;
          queryParams.push(filterObj.rssiMax);
          paramIndex++;
        }

        // GPS Accuracy filter
        if (enabledObj.gpsAccuracyMax && filterObj.gpsAccuracyMax !== undefined) {
          whereClause += ` AND (accuracy IS NOT NULL AND accuracy > 0 AND accuracy <= $${paramIndex})`;
          queryParams.push(filterObj.gpsAccuracyMax);
          paramIndex++;
        }

        // Exclude invalid coordinates
        if (enabledObj.excludeInvalidCoords) {
          whereClause += ' AND lat BETWEEN -90 AND 90 AND lon BETWEEN -180 AND 180';
        }

        // Quality filters
        if (
          enabledObj.qualityFilter &&
          filterObj.qualityFilter &&
          filterObj.qualityFilter !== 'none'
        ) {
          switch (filterObj.qualityFilter) {
            case 'extreme':
              whereClause += ' AND level BETWEEN -100 AND -20';
              break;
            case 'duplicate':
              whereClause += ` AND (lat, lon) NOT IN (
                SELECT lat, lon FROM public.observations 
                WHERE lat IS NOT NULL AND lon IS NOT NULL 
                GROUP BY lat, lon HAVING COUNT(*) > 10
              )`;
              break;
            case 'all':
              whereClause += ' AND level BETWEEN -100 AND -20';
              whereClause += ` AND (lat, lon) NOT IN (
                SELECT lat, lon FROM public.observations 
                WHERE lat IS NOT NULL AND lon IS NOT NULL 
                GROUP BY lat, lon HAVING COUNT(*) > 10
              )`;
              break;
          }
        }
      } catch (e) {
        logger.warn('Invalid filter parameters:', e.message);
      }
    }

    const result = await query(
      `
      SELECT
        bssid,
        ssid,
        level,
        lat,
        lon,
        altitude,
        accuracy,
        observed_at,
        device_id,
        source_tag,
        radio_type,
        radio_frequency,
        radio_capabilities,
        ST_AsGeoJSON(geom)::json as geometry
      FROM public.observations
      ${whereClause}
      ORDER BY observed_at DESC
    `,
      queryParams
    );

    const geojson = {
      type: 'FeatureCollection',
      features: result.rows.map((row) => ({
        type: 'Feature',
        geometry: row.geometry,
        properties: {
          bssid: row.bssid,
          ssid: row.ssid || 'Hidden Network',
          bestlevel: row.level || 0,
          signal: row.level || 0,
          first_seen: row.observed_at,
          last_seen: row.observed_at,
          timestamp: row.observed_at,
          manufacturer: 'Unknown',
          device_type: 'Unknown',
          type: inferRadioType(
            row.radio_type,
            row.ssid,
            row.radio_frequency,
            row.radio_capabilities
          ),
          channel: row.radio_frequency ? Math.floor((row.radio_frequency - 2407) / 5) : null,
          frequency: row.radio_frequency || null,
          capabilities: row.radio_capabilities || '',
          encryption: row.radio_capabilities || 'Open/Unknown',
          device_id: row.device_id,
          source_tag: row.source_tag,
          altitude: row.altitude,
          accuracy: row.accuracy,
        },
      })),
    };

    res.json(geojson);
  } catch (error) {
    logger.error(`Observations data error: ${error.message}`, { error });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/kepler/networks
 * Returns trilaterated networks from access_points for Kepler.gl.
 */
router.get('/kepler/networks', async (req, res) => {
  try {
    const { filters, enabled } = req.query;

    let whereClause = 'WHERE obs.lat IS NOT NULL AND obs.lon IS NOT NULL';
    const queryParams = [];
    let paramIndex = 1;

    // Apply filters if provided
    if (filters && enabled) {
      try {
        const filterObj = JSON.parse(filters);
        const enabledObj = JSON.parse(enabled);

        // SSID filter
        if (enabledObj.ssid && filterObj.ssid) {
          whereClause += ` AND (COALESCE(NULLIF(obs.ssid, ''), ap.latest_ssid) ILIKE $${paramIndex})`;
          queryParams.push(`%${filterObj.ssid}%`);
          paramIndex++;
        }

        // BSSID filter
        if (enabledObj.bssid && filterObj.bssid) {
          whereClause += ` AND ap.bssid ILIKE $${paramIndex}`;
          queryParams.push(`${filterObj.bssid}%`);
          paramIndex++;
        }

        // Radio Types filter
        if (enabledObj.radioTypes && filterObj.radioTypes && filterObj.radioTypes.length > 0) {
          whereClause += ` AND obs.radio_type = ANY($${paramIndex})`;
          queryParams.push(filterObj.radioTypes);
          paramIndex++;
        }

        // RSSI filters
        if (enabledObj.rssiMin && filterObj.rssiMin !== undefined) {
          whereClause += ` AND obs.level >= $${paramIndex}`;
          queryParams.push(filterObj.rssiMin);
          paramIndex++;
        }

        if (enabledObj.rssiMax && filterObj.rssiMax !== undefined) {
          whereClause += ` AND obs.level <= $${paramIndex}`;
          queryParams.push(filterObj.rssiMax);
          paramIndex++;
        }

        // GPS Accuracy filter
        if (enabledObj.gpsAccuracyMax && filterObj.gpsAccuracyMax !== undefined) {
          whereClause += ` AND (obs.accuracy IS NOT NULL AND obs.accuracy > 0 AND obs.accuracy <= $${paramIndex})`;
          queryParams.push(filterObj.gpsAccuracyMax);
          paramIndex++;
        }

        // Exclude invalid coordinates
        if (enabledObj.excludeInvalidCoords) {
          whereClause += ' AND obs.lat BETWEEN -90 AND 90 AND obs.lon BETWEEN -180 AND 180';
        }

        // Observation count filters (for networks endpoint)
        if (enabledObj.observationCountMin && filterObj.observationCountMin !== undefined) {
          whereClause += ` AND ap.total_observations >= $${paramIndex}`;
          queryParams.push(filterObj.observationCountMin);
          paramIndex++;
        }

        if (enabledObj.observationCountMax && filterObj.observationCountMax !== undefined) {
          whereClause += ` AND ap.total_observations <= $${paramIndex}`;
          queryParams.push(filterObj.observationCountMax);
          paramIndex++;
        }
      } catch (e) {
        logger.warn('Invalid filter parameters:', e.message);
      }
    }

    // Get networks from access_points with latest observation data
    const result = await query(
      `
      WITH obs_latest AS (
        SELECT DISTINCT ON (bssid)
          bssid,
          ssid,
          lat,
          lon,
          level,
          accuracy,
          time AS observed_at,
          radio_type,
          radio_frequency,
          radio_capabilities
        FROM public.observations
        WHERE lat IS NOT NULL AND lon IS NOT NULL
        ORDER BY bssid, time DESC
      )
      SELECT
        ap.bssid,
        COALESCE(NULLIF(obs.ssid, ''), ap.latest_ssid) AS ssid,
        obs.lat,
        obs.lon,
        obs.level,
        obs.accuracy,
        ap.total_observations AS observations,
        ap.first_seen,
        ap.last_seen,
        obs.radio_frequency AS frequency,
        obs.radio_capabilities AS capabilities,
        obs.radio_type AS type,
        ST_SetSRID(ST_MakePoint(obs.lon, obs.lat), 4326) AS geom
      FROM public.access_points ap
      LEFT JOIN obs_latest obs ON obs.bssid = ap.bssid
      ${whereClause}
      ORDER BY ap.last_seen DESC
    `,
      queryParams
    );

    const geojson = {
      type: 'FeatureCollection',
      features: result.rows
        .filter((row) => row.geom)
        .map((row) => ({
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
            level: row.level || 0,
            first_seen: row.first_seen,
            last_seen: row.last_seen,
            timestamp: row.last_seen,
            manufacturer: 'Unknown',
            device_type: 'Unknown',
            type: inferRadioType(row.type, row.ssid, row.frequency, row.capabilities),
            channel: row.frequency ? Math.floor((row.frequency - 2407) / 5) : null,
            frequency: row.frequency || null,
            capabilities: row.capabilities || '',
            encryption: row.capabilities || 'Open/Unknown',
            altitude: null,
            accuracy: row.accuracy,
            obs_count: row.observations || 0,
            observation_count: row.observations || 0,
            observations: row.observations || 0,
          },
        })),
    };

    res.json(geojson);
  } catch (error) {
    logger.error(`Networks data error: ${error.message}`, { error });
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
