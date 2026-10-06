import { execFile } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import util from 'util';
const execFilePromise = util.promisify(execFile);

const supportedMediaTypes = ['image/jpeg', 'image/png', 'video/mp4'] as const;
const isSupportedMediaType = (mimeType: string): boolean =>
  supportedMediaTypes.some((supportedType) => supportedType === mimeType);

export class ExifMissingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExifMissingError';
  }
}

export class ExifToolUnavailableError extends Error {
  constructor() {
    super('VISINT EXIF parser is unavailable. Install exiftool in the API runtime.');
    this.name = 'ExifToolUnavailableError';
  }
}

export class InvalidFileTypeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidFileTypeError';
  }
}

export async function validateMediaContent(filePath: string): Promise<string> {
  let stdout;
  try {
    const result = await execFilePromise('exiftool', ['-p', '$MIMEType', filePath]);
    stdout = result.stdout;
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      throw new ExifToolUnavailableError();
    }
    if (typeof error?.code === 'number') {
      throw new InvalidFileTypeError('Invalid file type. Only JPEG, PNG, and MP4 are allowed.');
    }
    throw error;
  }

  const mimeType = stdout.trim();
  if (!isSupportedMediaType(mimeType)) {
    throw new InvalidFileTypeError('Invalid file type. Only JPEG, PNG, and MP4 are allowed.');
  }
  return mimeType;
}

export async function validateMediaBuffer(
  imageBuffer: Buffer,
  declaredMimeType: string
): Promise<void> {
  if (!isSupportedMediaType(declaredMimeType)) {
    throw new InvalidFileTypeError('Invalid file type. Only JPEG, PNG, and MP4 are allowed.');
  }

  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'visint-validate-'));
  const tempFilePath = path.join(tempDirectory, 'upload');
  try {
    fs.writeFileSync(tempFilePath, imageBuffer);
    const actualMimeType = await validateMediaContent(tempFilePath);
    if (actualMimeType !== declaredMimeType) {
      throw new InvalidFileTypeError('Invalid file type. Only JPEG, PNG, and MP4 are allowed.');
    }
  } finally {
    try {
      fs.rmSync(tempDirectory, { recursive: true, force: true });
    } catch {
      // Best-effort cleanup of the temporary upload inspection file.
    }
  }
}

import { resolveImageCaptureInstant } from './visintTimezone';

/**
 * Extracts GPS telemetry and timestamp from a media file using exiftool
 */
export async function extractExif(
  imagePath: string
): Promise<{ lat: number; lon: number; timestamp: string; timestamp_source: string }> {
  let results;
  try {
    results = await Promise.all([
      execFilePromise('exiftool', ['-n', '-p', '$GPSLatitude', imagePath]),
      execFilePromise('exiftool', ['-n', '-p', '$GPSLongitude', imagePath]),
      execFilePromise('exiftool', [
        '-d',
        '%Y-%m-%d %H:%M:%S',
        '-p',
        '$DateTimeOriginal',
        imagePath,
      ]),
      execFilePromise('exiftool', ['-p', '$OffsetTimeOriginal', imagePath]).catch(() => ({
        stdout: '',
      })),
      execFilePromise('exiftool', [
        '-f',
        '-p',
        '$OffsetTime|$GPSDateStamp|$GPSTimeStamp',
        imagePath,
      ]).catch(() => ({
        stdout: '',
      })),
    ]);
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      throw new ExifToolUnavailableError();
    }
    throw new (Error as any)(`Failed to parse EXIF payload for ${imagePath}: ${error.message}`, {
      cause: error,
    });
  }

  const [latRes, lonRes, tsRes, offsetOrigRes, combinedRes] = results;
  const latStr = latRes.stdout.trim();
  const lonStr = lonRes.stdout.trim();
  const tsStr = tsRes.stdout.trim();
  const offsetOriginal = offsetOrigRes.stdout.trim();
  const combinedParts = (combinedRes.stdout || '').trim().split('|');
  const offsetTime = combinedParts[0] && combinedParts[0] !== '-' ? combinedParts[0].trim() : null;
  const gpsDate = combinedParts[1] && combinedParts[1] !== '-' ? combinedParts[1].trim() : null;
  const gpsTime = combinedParts[2] && combinedParts[2] !== '-' ? combinedParts[2].trim() : null;

  const missingFields: string[] = [];
  if (!latStr) {
    missingFields.push('GPSLatitude');
  }
  if (!lonStr) {
    missingFields.push('GPSLongitude');
  }
  if (!tsStr) {
    missingFields.push('DateTimeOriginal');
  }

  if (missingFields.length > 0) {
    throw new ExifMissingError(`Missing EXIF telemetry fields: ${missingFields.join(', ')}`);
  }

  const lat = parseFloat(latStr);
  const lon = parseFloat(lonStr);

  if (isNaN(lat) || isNaN(lon)) {
    const badFields: string[] = [];
    if (isNaN(lat)) {
      badFields.push('GPSLatitude');
    }
    if (isNaN(lon)) {
      badFields.push('GPSLongitude');
    }
    throw new ExifMissingError(`Invalid coordinate format in EXIF fields: ${badFields.join(', ')}`);
  }

  const resolved = resolveImageCaptureInstant(tsStr, offsetOriginal || null, {
    lat,
    lon,
    offsetTime,
    gpsDate,
    gpsTime,
  });

  return {
    lat,
    lon,
    timestamp: resolved.timestamp,
    timestamp_source: resolved.timestamp_source,
  };
}
