import type { Request, Response, NextFunction } from 'express';
/**
 * Network Observations Routes
 * Observation data and WiGLE crowdsourced observations
 */

import express from 'express';
const router = express.Router();
const { observationService } = require('../../../../config/container');
import logger from '../../../../logging/logger';
import { validateBSSID } from '../../../../validation/schemas';
const { asyncHandler } = require('../../../../utils/asyncHandler');

type NetworkObservationsParams = {
  bssid: string;
};

interface WigleObservationRow {
  bssid: string;
  lat: number;
  lon: number;
  time: number;
  level: number | null;
  ssid: string | null;
  frequency: number | null;
  channel: number | null;
  encryption: string | null;
  altitude: number | null;
  accuracy: number | null;
  is_matched: boolean;
  distance_from_our_center_m: number | null;
}

interface WigleObservationResponse {
  lat: number;
  lon: number;
  time: number;
  level: number | null;
  ssid: string | null;
  frequency: number | null;
  channel: number | null;
  encryption: string | null;
  altitude: number | null;
  accuracy: number | null;
  source: 'matched' | 'wigle_unique';
  distance_from_our_center_m: number | null;
}

interface WigleBatchNetwork {
  bssid: string;
  observations: WigleObservationResponse[];
  stats: {
    wigle_total: number;
    matched: number;
    unique: number;
    max_distance_m: number;
  };
}

/**
 * GET /networks/observations/:bssid - Get all observations for a network
 */
router.get(
  '/networks/observations/:bssid',
  asyncHandler(async (req: Request<NetworkObservationsParams>, res: Response) => {
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
  })
);

/**
 * GET /networks/:bssid/wigle-observations - Get WiGLE crowdsourced observations
 */
router.get(
  '/networks/:bssid/wigle-observations',
  asyncHandler(async (req: Request<NetworkObservationsParams>, res: Response) => {
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

    const result = (await observationService.getWigleObservationsByBSSID(
      cleanBssid
    )) as WigleObservationRow[];

    const total = result.length;
    const matched = result.filter((r: WigleObservationRow) => r.is_matched).length;
    const unique = total - matched;

    const ourCount = await observationService.getOurObservationCount(cleanBssid);

    const maxDistance = result.reduce((max: number, r: WigleObservationRow) => {
      // "Farthest" should reflect WiGLE-only sightings, not matched points.
      if (
        !r.is_matched &&
        typeof r.distance_from_our_center_m === 'number' &&
        r.distance_from_our_center_m > max
      ) {
        return r.distance_from_our_center_m;
      }
      return max;
    }, 0);

    res.json({
      ok: true,
      bssid: cleanBssid,
      observations: result.map(
        (r: WigleObservationRow): WigleObservationResponse => ({
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
        })
      ),
      stats: {
        wigle_total: total,
        matched: matched,
        unique: unique,
        our_observations: ourCount,
        max_distance_from_our_sightings_m: maxDistance,
      },
    });
  })
);

/**
 * POST /networks/wigle-observations/batch - Get WiGLE observations for multiple networks
 */
router.post(
  '/networks/wigle-observations/batch',
  asyncHandler(async (req: Request, res: Response) => {
    const { bssids } = req.body;

    if (!Array.isArray(bssids) || bssids.length === 0) {
      return res.status(400).json({ error: 'bssids array is required' });
    }

    const cleanBssids: string[] = [];
    for (const bssid of bssids as unknown[]) {
      if (typeof bssid !== 'string') {
        continue;
      }

      const validation = validateBSSID(bssid);
      if (validation.valid && validation.cleaned) {
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

    const result = (await observationService.getWigleObservationsBatch(
      cleanBssids
    )) as WigleObservationRow[];

    const networkMap = new Map<string, WigleBatchNetwork>();
    // Ensure selected networks are represented even when they have zero WiGLE rows.
    for (const bssid of cleanBssids) {
      const normalized = bssid.toUpperCase();
      networkMap.set(normalized, {
        bssid: normalized,
        observations: [],
        stats: { wigle_total: 0, matched: 0, unique: 0, max_distance_m: 0 },
      });
    }
    let totalMatched = 0;
    let totalUnique = 0;

    for (const row of result) {
      const bssid = row.bssid.toUpperCase();
      const network = networkMap.get(bssid);
      if (!network) {
        continue;
      }

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
      if (
        typeof row.distance_from_our_center_m === 'number' &&
        row.distance_from_our_center_m > network.stats.max_distance_m
      ) {
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
        network_count: cleanBssids.length,
      },
    });
  })
);

export default router;
