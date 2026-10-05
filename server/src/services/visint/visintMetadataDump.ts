import childProcess from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import util from 'util';
import logger from '../../logging/logger';

const execFilePromise = (
  file: string,
  args: string[],
  options?: any
): Promise<{ stdout: string; stderr: string }> =>
  (util.promisify(childProcess.execFile) as any)(file, args, options);

export const MAX_EXIF_RAW_BYTES = 512 * 1024; // 512 KB

export interface MetadataDumpPayload {
  exiftool_version: string;
  extracted_at: string;
  tags: Record<string, any>;
  truncated?: boolean;
  original_size?: number;
}

export interface TypedExifFields {
  exifMake: string | null;
  exifModel: string | null;
  exifAltitude: number | null;
  exifBearing: number | null;
  exifWidth: number | null;
  exifHeight: number | null;
}

/**
 * Matches a tag name across group families in priority order.
 * With ExifTool -G1, keys are formatted as Group:TagName (e.g. IFD0:Make, Keys:Make).
 */
export function pickTag(
  tags: Record<string, any>,
  tagName: string,
  groupPreferences: string[]
): any {
  if (!tags || typeof tags !== 'object') {
    return null;
  }

  // 1. Check preferred groups in explicit order
  for (const group of groupPreferences) {
    const key = `${group}:${tagName}`;
    if (key in tags && tags[key] !== undefined && tags[key] !== null && tags[key] !== '') {
      return tags[key];
    }
  }

  // 2. Direct key without group prefix
  if (
    tagName in tags &&
    tags[tagName] !== undefined &&
    tags[tagName] !== null &&
    tags[tagName] !== ''
  ) {
    return tags[tagName];
  }

  // 3. Fallback: match any key ending with :tagName
  for (const key of Object.keys(tags)) {
    const colonIdx = key.indexOf(':');
    if (colonIdx !== -1 && key.slice(colonIdx + 1) === tagName) {
      if (tags[key] !== undefined && tags[key] !== null && tags[key] !== '') {
        return tags[key];
      }
    }
  }

  return null;
}

/**
 * Sanitizes JSON values for PostgreSQL jsonb compatibility:
 * - Strips \u0000 (NUL characters) from strings.
 * - Replaces NaN, Infinity, -Infinity with null.
 */
export function sanitizeJsonValue(val: any): any {
  if (typeof val === 'string') {
    return val.split('\0').join('');
  }
  if (typeof val === 'number') {
    return Number.isFinite(val) ? val : null;
  }
  if (Array.isArray(val)) {
    return val.map(sanitizeJsonValue);
  }
  if (val !== null && typeof val === 'object') {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      out[k.split('\0').join('')] = sanitizeJsonValue(v);
    }
    return out;
  }
  return val;
}

/**
 * Extracts Migration 058 typed columns from the -G1 tags dictionary.
 */
export function extractTypedExifFromTags(tags: Record<string, any>): TypedExifFields {
  // Make & Model (IFD0, Keys, QuickTime, Samsung, ExifIFD, PNG, File)
  const makeGroups = ['IFD0', 'Keys', 'QuickTime', 'Samsung', 'ExifIFD', 'PNG', 'File'];
  const modelGroups = ['IFD0', 'Keys', 'QuickTime', 'Samsung', 'ExifIFD', 'PNG', 'File'];

  const rawMake = pickTag(tags, 'Make', makeGroups);
  const rawModel = pickTag(tags, 'Model', modelGroups);

  const exifMake =
    typeof rawMake === 'string' && rawMake.trim().length > 0 ? rawMake.trim().slice(0, 100) : null;

  const exifModel =
    typeof rawModel === 'string' && rawModel.trim().length > 0
      ? rawModel.trim().slice(0, 100)
      : null;

  // Altitude & GPSAltitudeRef (finite, -20000..100000, numeric(9,3))
  const altitudeGroups = ['Composite', 'GPS', 'QuickTime', 'Keys'];
  const rawAltitude = pickTag(tags, 'GPSAltitude', altitudeGroups);
  let exifAltitude: number | null = null;
  if (rawAltitude !== null && rawAltitude !== undefined) {
    const parsedAlt = parseFloat(String(rawAltitude));
    if (Number.isFinite(parsedAlt) && parsedAlt >= -20000 && parsedAlt <= 100000) {
      const altRef = pickTag(tags, 'GPSAltitudeRef', ['GPS', 'Composite', 'QuickTime', 'Keys']);
      const isBelowSea =
        altRef === 1 || altRef === '1' || String(altRef).toLowerCase().includes('below');
      const signedAlt = isBelowSea ? -Math.abs(parsedAlt) : parsedAlt;
      if (signedAlt >= -20000 && signedAlt <= 100000) {
        exifAltitude = Math.round(signedAlt * 1000) / 1000;
      }
    }
  }

  // Bearing (GPSImgDirection) (finite, 0..360, numeric(6,3))
  const bearingGroups = ['Composite', 'GPS', 'QuickTime', 'Keys'];
  const rawBearing = pickTag(tags, 'GPSImgDirection', bearingGroups);
  let exifBearing: number | null = null;
  if (rawBearing !== null && rawBearing !== undefined) {
    const parsedBearing = parseFloat(String(rawBearing));
    if (Number.isFinite(parsedBearing) && parsedBearing >= 0 && parsedBearing <= 360) {
      exifBearing = Math.round(parsedBearing * 1000) / 1000;
    }
  }

  // Dimensions (integer, 1..100000)
  const dimensionGroups = ['File', 'IFD0', 'ExifIFD', 'PNG', 'Track1', 'QuickTime', 'Composite'];
  const rawWidth =
    pickTag(tags, 'ImageWidth', dimensionGroups) ??
    pickTag(tags, 'ExifImageWidth', ['ExifIFD', 'IFD0', 'File']) ??
    pickTag(tags, 'SourceImageWidth', ['Track1', 'File']);
  const rawHeight =
    pickTag(tags, 'ImageHeight', dimensionGroups) ??
    pickTag(tags, 'ExifImageHeight', ['ExifIFD', 'IFD0', 'File']) ??
    pickTag(tags, 'SourceImageHeight', ['Track1', 'File']);

  let exifWidth: number | null = null;
  if (rawWidth !== null && rawWidth !== undefined) {
    const parsedW = parseInt(String(rawWidth), 10);
    if (Number.isInteger(parsedW) && parsedW >= 1 && parsedW <= 100000) {
      exifWidth = parsedW;
    }
  }

  let exifHeight: number | null = null;
  if (rawHeight !== null && rawHeight !== undefined) {
    const parsedH = parseInt(String(rawHeight), 10);
    if (Number.isInteger(parsedH) && parsedH >= 1 && parsedH <= 100000) {
      exifHeight = parsedH;
    }
  }

  return {
    exifMake,
    exifModel,
    exifAltitude,
    exifBearing,
    exifWidth,
    exifHeight,
  };
}

/**
 * Truncates oversized payloads (>512 KB) by replacing the largest individual tag values
 * with metadata placeholders until the payload fits within maxBytes.
 */
export function truncateOversizedPayload(
  payload: MetadataDumpPayload,
  maxBytes = MAX_EXIF_RAW_BYTES
): MetadataDumpPayload {
  const jsonStr = JSON.stringify(payload);
  const currentBytes = Buffer.byteLength(jsonStr, 'utf8');

  if (currentBytes <= maxBytes) {
    return payload;
  }

  const originalSize = currentBytes;
  payload.truncated = true;
  payload.original_size = originalSize;

  // Calculate size of each individual key in tags
  const keySizes: { key: string; size: number }[] = [];
  for (const [k, v] of Object.entries(payload.tags)) {
    const serializedVal = JSON.stringify(v);
    const size = Buffer.byteLength(serializedVal || '', 'utf8');
    keySizes.push({ key: k, size });
  }

  // Sort descending by value size
  keySizes.sort((a, b) => b.size - a.size);

  let updatedBytes = currentBytes;
  for (const item of keySizes) {
    if (updatedBytes <= maxBytes) {
      break;
    }

    const replacement = { truncated_value: true, original_size: item.size };
    payload.tags[item.key] = replacement;

    updatedBytes = Buffer.byteLength(JSON.stringify(payload), 'utf8');
  }

  // If still oversized due to tag count overhead, drop tags to empty object
  if (updatedBytes > maxBytes) {
    payload.tags = {};
  }

  logger.warn(
    `EXIF metadata payload exceeded 512 KB (${originalSize} bytes), truncated largest values to fit.`
  );

  return payload;
}

/**
 * Extracts a complete metadata dump from a file using ExifTool.
 * Returns fail-soft null on any execution error.
 */
export async function extractMetadataDumpFromFile(
  filePath: string
): Promise<{ rawJson: MetadataDumpPayload | null; typedExif: TypedExifFields }> {
  try {
    const result = await execFilePromise(
      'exiftool',
      [
        '-j',
        '-a',
        '-u',
        '-G1',
        '-s',
        '-n',
        '-api',
        'largefilesupport=1',
        '-x',
        'System:all',
        filePath,
      ],
      {
        maxBuffer: 16 * 1024 * 1024,
        timeout: 30000,
      }
    );

    const parsedArray = JSON.parse(result.stdout);
    const rawTags: Record<string, any> = parsedArray && parsedArray[0] ? parsedArray[0] : {};

    // Remove SourceFile since it reflects server temp file location
    delete rawTags.SourceFile;

    const version = rawTags['ExifTool:ExifToolVersion']
      ? String(rawTags['ExifTool:ExifToolVersion'])
      : 'unknown';

    const sanitizedTags = sanitizeJsonValue(rawTags);
    const typedExif = extractTypedExifFromTags(sanitizedTags);

    const payload: MetadataDumpPayload = {
      exiftool_version: version,
      extracted_at: new Date().toISOString(),
      tags: sanitizedTags,
    };

    const truncatedPayload = truncateOversizedPayload(payload);

    return {
      rawJson: truncatedPayload,
      typedExif,
    };
  } catch (error) {
    logger.warn(
      `EXIF metadata dump extraction skipped or failed; proceeding with NULL exif_raw: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return {
      rawJson: null,
      typedExif: {
        exifMake: null,
        exifModel: null,
        exifAltitude: null,
        exifBearing: null,
        exifWidth: null,
        exifHeight: null,
      },
    };
  }
}

/**
 * Extracts metadata dump from an in-memory buffer via a temporary file.
 */
export async function extractMetadataDumpFromBuffer(
  buffer: Buffer
): Promise<{ rawJson: MetadataDumpPayload | null; typedExif: TypedExifFields }> {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'visint-dump-'));
  const tempFile = path.join(tempDir, 'media');
  try {
    fs.writeFileSync(tempFile, buffer);
    return await extractMetadataDumpFromFile(tempFile);
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Best-effort cleanup
    }
  }
}
