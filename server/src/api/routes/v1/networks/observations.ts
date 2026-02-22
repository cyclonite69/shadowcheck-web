/**
 * Network Observations Routes
 * Observation data and WiGLE crowdsourced observations
 */

import express from 'express';
const router = express.Router();
const { observationService } = require('../../../../config/container');
import logger from '../../../../logging/logger';
import { validateBSSID } from '../../../../validation/schemas';

/**
 * GET /networks/observations/:bssid - Get all observations for a network
 */
router.get('/networks/observations/:bssid', async (req, res, next) => {
  try {
    const { bssid } = req.params;
    const bssidValidation = validateBSSID(bssid);
    if (!bssidValidation.valid) {
      return res.status(400).json({ error: bssidValidation.error });
    }

    let home = null;
    try {
      home = await observationService.getHomeLocationForObservations();
    } catch {
      home = null;
    }

    const rows = await observationService.getObservationsByBSSID(
      bssidValidation.cleaned,
      home?.lon,
      home?.lat
    );

    res.json({
      ok: true,
      bssid: bssidValidation.cleaned,
      observations: rows,
      home: home,
      count: rows.length,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /networks/:bssid/wigle-observations - Get WiGLE crowdsourced observations
 */
router.get('/networks/:bssid/wigle-observations', async (req, res, next) => {
  try {
    const { bssid } = req.params;
    const bssidValidation = validateBSSID(bssid);
    if (!bssidValidation.valid) {
      return res.status(400).json({ error: bssidValidation.error });
    }

    const cleanBssid = bssidValidation.cleaned;

    const tableExists = await observationService.checkWigleTableExists();

    if (!tableExists) {
      return res.json({
        ok: true,
        bssid: cleanBssid,
        observations: [],
        stats: { total: 0, matched: 0, unique: 0 },
        message: 'WiGLE v3 observations table not available',
      });
    }

    const result = await observationService.getWigleObservationsByBSSID(cleanBssid);

    const total = result.length;
    const matched = result.filter((r) => r.is_matched).length;
    const unique = total - matched;

    const ourCount = await observationService.getOurObservationCount(cleanBssid);

    const maxDistance = result.reduce((max, r) => {
      if (r.distance_from_our_center_m && r.distance_from_our_center_m > max) {
        return r.distance_from_our_center_m;
      }
      return max;
    }, 0);

    res.json({
      ok: true,
      bssid: cleanBssid,
      observations: result.map((r) => ({
        lat: r.lat,
        lon: r.lon,
        time: r.time,
        level: r.level,
        ssid: r.ssid,
        frequency: r.frequency,
        channel: r.channel,
        encryption: r.encryption,
        altitude: r.altitude,
        accuracy: r.accuracy,
        source: r.is_matched ? 'matched' : 'wigle_unique',
        distance_from_our_center_m: r.distance_from_our_center_m,
      })),
      stats: {
        wigle_total: total,
        matched: matched,
        unique: unique,
        our_observations: ourCount,
        max_distance_from_our_sightings_m: maxDistance,
      },
    });
  } catch (err: any) {
    logger.error('Error fetching WiGLE observations', { error: err.message });
    next(err);
  }
});

/**
 * POST /networks/wigle-observations/batch - Get WiGLE observations for multiple networks
 */
router.post('/networks/wigle-observations/batch', async (req, res, next) => {
  try {
    const { bssids } = req.body;

    if (!Array.isArray(bssids) || bssids.length === 0) {
      return res.status(400).json({ error: 'bssids array is required' });
    }

    const cleanBssids = [];
    for (const bssid of bssids) {
      const validation = validateBSSID(bssid);
      if (validation.valid) {
        cleanBssids.push(validation.cleaned);
      }
    }

    if (cleanBssids.length === 0) {
      return res.status(400).json({ error: 'No valid BSSIDs provided' });
    }

    const tableExists = await observationService.checkWigleTableExists();

    if (!tableExists) {
      return res.json({
        ok: true,
        networks: [],
        stats: { total_wigle: 0, total_matched: 0, total_unique: 0 },
        message: 'WiGLE v3 observations table not available',
      });
    }

    const result = await observationService.getWigleObservationsBatch(cleanBssids);

    const networkMap = new Map();
    let totalMatched = 0;
    let totalUnique = 0;

    for (const row of result) {
      const bssid = row.bssid.toUpperCase();
      if (!networkMap.has(bssid)) {
        networkMap.set(bssid, {
          bssid,
          observations: [],
          stats: { wigle_total: 0, matched: 0, unique: 0, max_distance_m: 0 },
        });
      }
      const network = networkMap.get(bssid);
      network.observations.push({
        lat: row.lat,
        lon: row.lon,
        time: row.time,
        level: row.level,
        ssid: row.ssid,
        frequency: row.frequency,
        channel: row.channel,
        encryption: row.encryption,
        altitude: row.altitude,
        accuracy: row.accuracy,
        source: row.is_matched ? 'matched' : 'wigle_unique',
        distance_from_our_center_m: row.distance_from_our_center_m,
      });
      network.stats.wigle_total++;
      if (row.is_matched) {
        network.stats.matched++;
        totalMatched++;
      } else {
        network.stats.unique++;
        totalUnique++;
      }
      if (row.distance_from_our_center_m > network.stats.max_distance_m) {
        network.stats.max_distance_m = row.distance_from_our_center_m;
      }
    }

    res.json({
      ok: true,
      networks: Array.from(networkMap.values()),
      stats: {
        total_wigle: result.length,
        total_matched: totalMatched,
        total_unique: totalUnique,
        network_count: networkMap.size,
      },
    });
  } catch (err: any) {
    logger.error('Error fetching batch WiGLE observations', { error: err.message });
    next(err);
  }
});

export default router;
