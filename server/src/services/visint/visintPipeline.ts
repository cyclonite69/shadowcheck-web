import sharp from 'sharp';
import {
  extractExif,
  InvalidFileTypeError,
  validateMediaBuffer,
  validateMediaContent,
} from './visintExif';
import { extractVideoTelemetry } from './visintVideoExif';
import crypto from 'crypto';
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

type SaveVisINTOptions = {
  contentValidated?: boolean;
  videoTelemetry?: Awaited<ReturnType<typeof extractVideoTelemetry>>;
};

type ExtractedTelemetry = {
  lat: number | null;
  lon: number | null;
  timestamp: string | null;
  media_type?: string;
  timestamp_source?: string;
  timestamp_is_start_estimate?: boolean;
  duration_s?: number;
};

function createTempMediaFile(prefix: string, buffer: Buffer): { path: string; directory: string } {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const tempPath = path.join(directory, 'upload');
  try {
    fs.writeFileSync(tempPath, buffer);
  } catch (error) {
    fs.rmSync(directory, { recursive: true, force: true });
    throw error;
  }
  return { path: tempPath, directory };
}

function cleanupTempMediaDirectory(directory: string): void {
  try {
    fs.rmSync(directory, { recursive: true, force: true });
  } catch {
    // Best-effort cleanup of temporary media.
  }
}

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
  filename: string,
  mimeType: string
): Promise<ExtractedTelemetry> {
  const tempFile = createTempMediaFile('visint-exif-', imageBuffer);
  try {
    if (mimeType === 'video/mp4') {
      const videoData = await extractVideoTelemetry(tempFile.path, filename);
      return {
        lat: videoData.lat ?? null,
        lon: videoData.lon ?? null,
        timestamp: videoData.timestamp ?? null,
        media_type: videoData.media_type,
        timestamp_source: videoData.timestamp_source,
        timestamp_is_start_estimate: videoData.timestamp_is_start_estimate,
        duration_s: videoData.duration_s,
      };
    } else {
      const exifData = await extractExif(tempFile.path);
      return {
        lat: exifData.lat ?? null,
        lon: exifData.lon ?? null,
        timestamp: exifData.timestamp ?? null,
      };
    }
  } catch (error) {
    logger.debug(
      `EXIF extraction skipped or failed for ${filename}: ${error instanceof Error ? error.message : String(error)}`
    );
    return { lat: null, lon: null, timestamp: null };
  } finally {
    cleanupTempMediaDirectory(tempFile.directory);
  }
}

export async function generateThumbnail(buffer: Buffer, mimeType: string): Promise<Buffer | null> {
  if (mimeType === 'image/jpeg' || mimeType === 'image/png') {
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
  } else if (mimeType === 'video/mp4') {
    logger.debug('video thumbnail generation not yet supported');
    return null;
  }
  return null;
}

export async function saveVisINTAttachment(
  imageBuffer: Buffer,
  filename: string,
  mimeType: string,
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
  observationId: number | string | null = null,
  options: SaveVisINTOptions = {}
): Promise<string[]> {
  if (!options.contentValidated) {
    await validateMediaBuffer(imageBuffer, mimeType);
  }

  const mediaType = mimeType === 'video/mp4' ? 'video' : 'image';

  // Extract EXIF if not provided
  let resolvedLat: number | null = lat !== undefined && lat !== null ? lat : null;
  let resolvedLon: number | null = lon !== undefined && lon !== null ? lon : null;
  let resolvedTs: string | null = ts !== undefined && ts !== null ? ts : null;

  let extracted: ExtractedTelemetry | null = options.videoTelemetry ?? null;
  if (mimeType === 'video/mp4' && !extracted) {
    extracted = await extractExifFromBuffer(imageBuffer, filename, mimeType);
  } else if (resolvedLat === null || resolvedLon === null || resolvedTs === null) {
    extracted = await extractExifFromBuffer(imageBuffer, filename, mimeType);
  }
  if (extracted) {
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

  const mediaDesc =
    mimeType === 'video/mp4'
      ? JSON.stringify({
          status,
          extracted_lat: resolvedLat || 0,
          extracted_lon: resolvedLon || 0,
          extracted_ts: resolvedTs || '',
          ...(!isUnmatched
            ? {
                dist_meters: distMeters,
                delta_minutes: deltaMinutes,
                detection_score: detectionScore,
                manual: isManualOverride,
              }
            : {}),
          ...(extracted && 'timestamp_source' in extracted
            ? {
                timestamp_source: extracted.timestamp_source,
                timestamp_is_start_estimate: extracted.timestamp_is_start_estimate,
                duration_s: extracted.duration_s,
              }
            : {}),
        })
      : isUnmatched
        ? JSON.stringify({
            extracted_lat: resolvedLat || 0,
            extracted_lon: resolvedLon || 0,
            extracted_ts: resolvedTs || '',
            status: 'UNMATCHED',
          })
        : `VisINT Correlation: dist_meters=${distMeters}, delta_minutes=${deltaMinutes}, score=${detectionScore}, manual=${isManualOverride}`;

  await insertNetworkMedia(
    targetBssid,
    mediaType,
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
  mimeType: string,
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
  exif: {
    lat: number;
    lon: number;
    ts: string;
    timestamp_source?: string;
    timestamp_is_start_estimate?: boolean;
    duration_s?: number;
  };
  candidates: any[];
}> {
  const tempFile = createTempMediaFile('visint-', imageBuffer);
  let exifData:
    | Awaited<ReturnType<typeof extractExif>>
    | Awaited<ReturnType<typeof extractVideoTelemetry>>;
  try {
    const actualMimeType = await validateMediaContent(tempFile.path);
    if (actualMimeType !== mimeType) {
      throw new InvalidFileTypeError('Invalid file type. Only JPEG, PNG, and MP4 are allowed.');
    }

    const hash = crypto.createHash('sha256').update(imageBuffer).digest('hex');
    const existing = await query(
      'SELECT id FROM app.network_media WHERE image_sha256 = $1 LIMIT 1',
      [hash]
    );
    if (existing.rows.length > 0) {
      const error: any = new Error('Duplicate media content');
      error.code = 'VISINT_DUPLICATE_MEDIA';
      error.existingId = existing.rows[0].id;
      throw error;
    }

    if (mimeType === 'video/mp4') {
      exifData = await extractVideoTelemetry(tempFile.path, filename);
    } else {
      exifData = await extractExif(tempFile.path);
    }
  } finally {
    cleanupTempMediaDirectory(tempFile.directory);
  }

  const { lat, lon, timestamp: ts } = exifData;
  const durationS = 'duration_s' in exifData ? exifData.duration_s : undefined;

  // Query database using spatial-temporal parameters and signature scoring
  const rows = await queryCorrelatedObservations(
    query,
    lon,
    lat,
    ts,
    radiusMeters,
    windowHours,
    limit,
    durationS || 0
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
      mimeType,
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
      observationId,
      {
        contentValidated: true,
        videoTelemetry: 'duration_s' in exifData ? exifData : undefined,
      }
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
    exif: {
      lat,
      lon,
      ts,
      ...('timestamp_source' in exifData
        ? {
            timestamp_source: exifData.timestamp_source,
            timestamp_is_start_estimate: exifData.timestamp_is_start_estimate,
            duration_s: exifData.duration_s,
          }
        : {}),
    },
    candidates: rows,
  };
}
