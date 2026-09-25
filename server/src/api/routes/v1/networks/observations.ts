import type { Request, Response, NextFunction } from 'express';
/**
 * Network Observations Routes
 * Observation data and WiGLE crowdsourced observations
 */

import express from 'express';
const router = express.Router();
const multer = require('multer');
const { observationService } = require('../../../../config/container');
import logger from '../../../../logging/logger';
import { validateBSSID } from '../../../../validation/schemas';
const { asyncHandler } = require('../../../../utils/asyncHandler');

const VISINT_UPLOAD_MAX_BYTES = 25 * 1024 * 1024;
const VISINT_UPLOAD_MAX_MB = VISINT_UPLOAD_MAX_BYTES / (1024 * 1024);
type UploadedVisintFile = {
  buffer?: Buffer;
  originalname?: string;
};

const visintUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: VISINT_UPLOAD_MAX_BYTES,
  },
  fileFilter: (req: any, file: any, cb: any) => {
    if (
      file.mimetype === 'image/jpeg' ||
      file.mimetype === 'image/jpg' ||
      file.mimetype === 'image/png'
    ) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG and PNG are allowed.'));
    }
  },
});

const parseOptionalNumber = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const parseOptionalNullableNumber = (value: unknown): number | null => {
  const parsed = parseOptionalNumber(value);
  return parsed === undefined ? null : parsed;
};

const isProvidedAndInvalid = (value: unknown): boolean => {
  if (value === undefined || value === null || value === '') {
    return false;
  }
  const parsed = Number(value);
  return !Number.isFinite(parsed);
};

const parseBooleanField = (value: unknown, fallback: boolean): boolean => {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  return String(value).toLowerCase() === 'true';
};

const handleVisintImageUpload = (req: Request, res: Response, next: NextFunction): void => {
  visintUpload.single('image')(req, res, (error: unknown) => {
    if (!error) {
      next();
      return;
    }
    const uploadError = error as { code?: string; message?: string };
    if (uploadError.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({
        ok: false,
        error: `VISINT image exceeds ${VISINT_UPLOAD_MAX_MB} MB limit.`,
        code: 'PAYLOAD_TOO_LARGE',
      });
      return;
    }
    if (uploadError.message === 'Invalid file type. Only JPEG and PNG are allowed.') {
      res.status(400).json({
        ok: false,
        error: uploadError.message,
        code: 'INVALID_FILE_TYPE',
      });
      return;
    }
    next(error);
  });
};

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

    const home = await observationService.getHomeLocationForObservations().catch(() => null);

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

/**
 * POST /api/observations/correlate-visint
 *
 * Correlates VisINT photo telemetry with nearby observations in the database.
 * Accepts a multipart/form-data body containing an image file and tuning metadata.
 */
router.post(
  '/observations/correlate-visint',
  handleVisintImageUpload,
  asyncHandler(async (req: Request, res: Response) => {
    const uploadedFile = (req as Request & { file?: UploadedVisintFile }).file;
    const filename =
      req.body.filename || req.body.original_filename || uploadedFile?.originalname || 'image.jpg';
    const commit = parseBooleanField(req.body.commit, false);
    const confirmFallback = parseBooleanField(req.body.confirm_fallback, false);
    if (
      isProvidedAndInvalid(req.body.radius_meters) ||
      isProvidedAndInvalid(req.body.window_hours) ||
      isProvidedAndInvalid(req.body.limit)
    ) {
      return res.status(400).json({
        ok: false,
        error: 'Invalid numeric parameters for VisINT correlation.',
        code: 'VISINT_INVALID_NUMERIC_PARAMS',
      });
    }

    const radiusMeters = parseOptionalNumber(req.body.radius_meters);
    const windowHours = parseOptionalNumber(req.body.window_hours);
    const limit = parseOptionalNumber(req.body.limit);

    if (!uploadedFile?.buffer) {
      return res.status(400).json({ error: 'VISINT image file field is required.' });
    }

    try {
      const result = await observationService.correlateVisINT(
        uploadedFile.buffer,
        filename,
        commit,
        radiusMeters,
        windowHours,
        limit,
        confirmFallback
      );
      res.json({ ok: true, ...result });
    } catch (error: any) {
      if (error.name === 'ExifMissingError') {
        return res.status(400).json({ error: error.message, type: 'ExifMissingError' });
      }
      if (error.name === 'ExifToolUnavailableError') {
        return res.status(503).json({
          error: error.message,
          type: 'ExifToolUnavailableError',
          code: 'VISINT_EXIF_TOOL_UNAVAILABLE',
        });
      }
      if (error.name === 'VISINTFallbackRequiresConfirmationError') {
        return res.status(400).json({
          error: error.message,
          code: 'VISINT_FALLBACK_REQUIRES_CONFIRMATION',
        });
      }
      logger.error(`VisINT correlation failed: ${error.message}`);
      res.status(500).json({ error: 'VisINT correlation failed', details: error.message });
    }
  })
);

/**
 * POST /api/observations/attach-visint
 *
 * Commits a VisINT photo attachment and auto-tags to a selected network observation.
 * Accepts a multipart/form-data body containing an image file, target BSSID, scores/deltas,
 * and optional manual_override + device_type fields that gate ground-truth evidence tagging.
 */
router.post(
  '/observations/attach-visint',
  handleVisintImageUpload,
  asyncHandler(async (req: Request, res: Response) => {
    const uploadedFile = (req as Request & { file?: UploadedVisintFile }).file;
    const filename =
      req.body.filename || req.body.original_filename || uploadedFile?.originalname || 'image.jpg';
    const targetBssid = req.body.bssid || 'VISINT_UNMATCHED';
    const status = req.body.status || 'UNMATCHED';
    if (
      isProvidedAndInvalid(req.body.dist_meters) ||
      isProvidedAndInvalid(req.body.delta_minutes) ||
      isProvidedAndInvalid(req.body.lat) ||
      isProvidedAndInvalid(req.body.lon)
    ) {
      return res.status(400).json({
        ok: false,
        error: 'Invalid numeric parameters on attach-visint.',
        code: 'VISINT_INVALID_NUMERIC_PARAMS',
      });
    }

    let detectionScore = 0;
    if (
      req.body.detection_score !== undefined &&
      req.body.detection_score !== null &&
      req.body.detection_score !== ''
    ) {
      detectionScore = parseInt(req.body.detection_score, 10);
      if (isNaN(detectionScore)) {
        return res.status(400).json({
          ok: false,
          error: 'Invalid detection_score value.',
          code: 'VISINT_INVALID_DETECTION_SCORE',
        });
      }
    }

    const distMeters = parseOptionalNullableNumber(req.body.dist_meters);
    const deltaMinutes = parseOptionalNullableNumber(req.body.delta_minutes);
    const lat = parseOptionalNumber(req.body.lat);
    const lon = parseOptionalNumber(req.body.lon);
    const ts = req.body.ts || undefined;
    const isManualOverride = req.body.manual_override === 'true';
    const deviceType: string | null = req.body.device_type || null;
    const observationId = req.body.observation_id || req.body.observationId || null;

    // Sentinel guard: attaching to the fallback BSSID requires explicit opt-in.
    // Prevents agent/curl calls from silently writing unmatched fallback rows.
    if (targetBssid === 'VISINT_UNMATCHED' && req.body.confirm_fallback !== 'true') {
      return res.status(400).json({
        error:
          'Attaching to the VISINT_UNMATCHED fallback BSSID requires explicit confirmation. Set confirm_fallback=true to proceed.',
        code: 'VISINT_FALLBACK_REQUIRES_CONFIRMATION',
      });
    }

    if (!uploadedFile?.buffer) {
      return res.status(400).json({ error: 'VISINT image file field is required.' });
    }

    try {
      const tagsApplied = await observationService.saveVisINTAttachment(
        uploadedFile.buffer,
        filename,
        targetBssid,
        status,
        detectionScore,
        distMeters,
        deltaMinutes,
        lat,
        lon,
        ts,
        isManualOverride,
        deviceType,
        observationId
      );
      res.json({ ok: true, success: true, tags_applied: tagsApplied });
    } catch (error: any) {
      logger.error(`VisINT attachment failed: ${error.message}`);
      res.status(500).json({ error: 'VisINT attachment failed', details: error.message });
    }
  })
);

export default router;
