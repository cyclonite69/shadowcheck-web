import sharp from 'sharp';
import { extractExif } from './visintExif';
import { queryCorrelatedObservations } from './visintScorer';

const { query } = require('../../config/database');
const logger = require('../../logging/logger');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { insertNetworkMedia } = require('../../repositories/adminNetworkMediaRepository');
const {
  addTagToNetwork,
  getNetworkTagsByBssid,
  insertNetworkTagWithNotes,
} = require('../../repositories/adminNetworkTagOuiRepository');

/**
 * Derive the tag set to apply for a VISINT attachment.
 *
 * Rules:
 *  - Explicit unmatched (targetBssid === 'VISINT_UNMATCHED'): UNMATCHED_NODE + VISINT_UNMATCHED
 *  - Manual attachment to a real BSSID: VISINT_SPATIAL_MATCH + VISINT_MANUAL_MATCH + VISINT_CONFIRMED
 *    + GROUND_TRUTH_IMAGE, plus device-type tag if known
 *  - Auto-matched with score ≥ 1: score-based Flock/ShotSpotter tags + VISINT_VERIFIED/PENDING
 *  - Auto-matched with score 0 but real BSSID: VISINT_SPATIAL_MATCH only
 */
export function deriveVisintTags(
  targetBssid: string,
  detectionScore: number,
  deviceType: string | null,
  isManualOverride: boolean
): string[] {
  // Fallback/unmatched path — sentinel BSSID only
  if (targetBssid === 'VISINT_UNMATCHED') {
    return ['UNMATCHED_NODE', 'VISINT_UNMATCHED'];
  }

  // Manual attachment to a real candidate — ground-truth evidence path
  if (isManualOverride) {
    const tags: string[] = [
      'VISINT_SPATIAL_MATCH',
      'VISINT_MANUAL_MATCH',
      'VISINT_CONFIRMED',
      'GROUND_TRUTH_IMAGE',
    ];
    if (deviceType === 'SHOTSPOTTER_SENSOR') {
      tags.push('SHOTSPOTTER_SENSOR');
    } else if (deviceType === 'FLOCK_SAFETY_CAMERA') {
      // Retain Flock score-based specificity even on manual override
      if (detectionScore >= 4) {
        tags.push('FLOCK_NEW_FIRMWARE');
      } else if (detectionScore >= 3) {
        tags.push('FLOCK_LEGACY');
      } else {
        tags.push('FLOCK_CANDIDATE');
      }
    }
    return tags;
  }

  // Auto-matched paths — score-based tagging
  if (deviceType === 'SHOTSPOTTER_SENSOR') {
    if (detectionScore >= 2) {
      return ['SHOTSPOTTER_SENSOR', 'VISINT_VERIFIED'];
    }
    return ['SHOTSPOTTER_SENSOR', 'VISINT_PENDING'];
  }

  if (deviceType === 'FLOCK_SAFETY_CAMERA') {
    if (detectionScore >= 4) {
      return ['FLOCK_NEW_FIRMWARE', 'VISINT_VERIFIED'];
    } else if (detectionScore >= 3) {
      return ['FLOCK_LEGACY', 'VISINT_VERIFIED'];
    } else if (detectionScore >= 1) {
      return ['FLOCK_CANDIDATE', 'VISINT_PENDING'];
    }
  }

  // Score ≥ 1 but no recognised device type
  if (detectionScore >= 1) {
    return ['VISINT_PENDING'];
  }

  // Real BSSID, score 0, auto-selected — spatial proximity only
  return ['VISINT_SPATIAL_MATCH'];
}

async function extractExifFromBuffer(
  imageBuffer: Buffer,
  filename: string
): Promise<{ lat: number | null; lon: number | null; timestamp: string | null }> {
  const tempFilePath = path.join(os.tmpdir(), `visint-exif-${Date.now()}-${filename}`);
  fs.writeFileSync(tempFilePath, imageBuffer);
  try {
    const exifData = await extractExif(tempFilePath);
    return {
      lat: exifData.lat ?? null,
      lon: exifData.lon ?? null,
      timestamp: exifData.timestamp ?? null,
    };
  } catch (error) {
    logger.debug(
      `EXIF extraction skipped or failed for ${filename}: ${error instanceof Error ? error.message : String(error)}`
    );
    return { lat: null, lon: null, timestamp: null };
  } finally {
    try {
      fs.unlinkSync(tempFilePath);
    } catch (cleanupErr) {
      // ignore
    }
  }
}

export async function generateThumbnail(buffer: Buffer, mimeType: string): Promise<Buffer | null> {
  if (mimeType.startsWith('image/')) {
    try {
      return await sharp(buffer)
        .rotate()
        .resize({
          width: 400,
          height: 400,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: 80 })
        .toBuffer();
    } catch (err) {
      logger.error(
        `Thumbnail generation failed: ${err instanceof Error ? err.message : String(err)}`
      );
      return null;
    }
  } else if (mimeType.startsWith('video/')) {
    logger.debug('video thumbnail generation not yet supported');
    return null;
  }
  return null;
}

export async function saveVisINTAttachment(
  imageBuffer: Buffer,
  filename: string,
  targetBssid: string,
  status: 'MATCHED' | 'UNMATCHED',
  detectionScore: number,
  distMeters: number | null,
  deltaMinutes: number | null,
  lat?: number,
  lon?: number,
  ts?: string,
  isManualOverride: boolean = false,
  deviceType: string | null = null,
  observationId: number | string | null = null
): Promise<string[]> {
  const mimeType = String(filename).toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';

  // Extract EXIF if not provided
  let resolvedLat: number | null = lat !== undefined && lat !== null ? lat : null;
  let resolvedLon: number | null = lon !== undefined && lon !== null ? lon : null;
  let resolvedTs: string | null = ts !== undefined && ts !== null ? ts : null;

  if (resolvedLat === null || resolvedLon === null || resolvedTs === null) {
    const extracted = await extractExifFromBuffer(imageBuffer, filename);
    if (resolvedLat === null) {
      resolvedLat = extracted.lat;
    }
    if (resolvedLon === null) {
      resolvedLon = extracted.lon;
    }
    if (resolvedTs === null) {
      resolvedTs = extracted.timestamp;
    }
  }

  // Generate thumbnail
  const thumbnailBuffer = await generateThumbnail(imageBuffer, mimeType);

  const isUnmatched = targetBssid === 'VISINT_UNMATCHED';

  const mediaDesc = isUnmatched
    ? JSON.stringify({
        extracted_lat: resolvedLat || 0,
        extracted_lon: resolvedLon || 0,
        extracted_ts: resolvedTs || '',
        status: 'UNMATCHED',
      })
    : `VisINT Correlation: dist_meters=${distMeters}, delta_minutes=${deltaMinutes}, score=${detectionScore}, manual=${isManualOverride}`;

  await insertNetworkMedia(
    targetBssid,
    'image',
    filename,
    imageBuffer.length,
    mimeType,
    imageBuffer,
    mediaDesc,
    resolvedLat,
    resolvedLon,
    resolvedTs,
    thumbnailBuffer,
    observationId
  );

  const tagsToApply = deriveVisintTags(targetBssid, detectionScore, deviceType, isManualOverride);

  // Save tags
  const existing = await getNetworkTagsByBssid(targetBssid);
  if (!existing) {
    await insertNetworkTagWithNotes(targetBssid, tagsToApply, null);
  } else {
    for (const tag of tagsToApply) {
      await addTagToNetwork(targetBssid, tag, null);
    }
  }

  return tagsToApply;
}

export async function correlateVisINT(
  imageBuffer: Buffer,
  filename: string,
  commit = false,
  radiusMeters = 50,
  windowHours = 2,
  limit = 5,
  confirmFallback = false
): Promise<{
  status: 'MATCHED' | 'UNMATCHED';
  observation_id: string | null;
  detection_score: number;
  dist_meters: number | null;
  delta_minutes: number | null;
  tags_applied: string[];
  exif: { lat: number; lon: number; ts: string };
  candidates: any[];
}> {
  const tempFilePath = path.join(os.tmpdir(), `visint-${Date.now()}-${filename}`);
  fs.writeFileSync(tempFilePath, imageBuffer);

  let exifData;
  try {
    exifData = await extractExif(tempFilePath);
  } finally {
    try {
      fs.unlinkSync(tempFilePath);
    } catch {
      // ignore
    }
  }

  const { lat, lon, timestamp: ts } = exifData;

  // Query database using spatial-temporal parameters and signature scoring
  const rows = await queryCorrelatedObservations(
    query,
    lon,
    lat,
    ts,
    radiusMeters,
    windowHours,
    limit
  );

  let status: 'MATCHED' | 'UNMATCHED' = 'UNMATCHED';
  let observationId: string | null = null;
  let detectionScore = 0;
  let distMeters: number | null = null;
  let deltaMinutes: number | null = null;
  let targetBssid = 'VISINT_UNMATCHED';
  let deviceType: string | null = null;
  let tagsToApply: string[];

  if (rows.length > 0 && parseInt(rows[0].detection_score, 10) >= 1) {
    const bestMatch = rows[0];
    status = 'MATCHED';
    observationId = String(bestMatch.id);
    detectionScore = parseInt(bestMatch.detection_score, 10);
    distMeters = parseFloat(bestMatch.dist_meters);
    deltaMinutes = parseFloat(bestMatch.delta_minutes);
    targetBssid = String(bestMatch.bssid).toUpperCase();
    deviceType = bestMatch.device_type || null;
  }

  if (commit && targetBssid === 'VISINT_UNMATCHED' && !confirmFallback) {
    const error = new Error(
      'Correlating to the VISINT_UNMATCHED fallback BSSID requires explicit confirmation. Set confirm_fallback=true to proceed.'
    );
    (error as Error & { name: string }).name = 'VISINTFallbackRequiresConfirmationError';
    throw error;
  }

  if (commit) {
    tagsToApply = await saveVisINTAttachment(
      imageBuffer,
      filename,
      targetBssid,
      status,
      detectionScore,
      distMeters,
      deltaMinutes,
      lat,
      lon,
      ts,
      false, // correlateVisINT is always auto — not manual
      deviceType,
      observationId
    );
  } else {
    // Preview tags — derive without committing
    tagsToApply = deriveVisintTags(targetBssid, detectionScore, deviceType, false);
  }

  return {
    status,
    observation_id: observationId,
    detection_score: detectionScore,
    dist_meters: distMeters,
    delta_minutes: deltaMinutes,
    tags_applied: tagsToApply,
    exif: { lat, lon, ts },
    candidates: rows,
  };
}
