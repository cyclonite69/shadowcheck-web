const { execFile } = require('child_process');
const util = require('util');
const execFilePromise = util.promisify(execFile);

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

/**
 * Extracts GPS telemetry and timestamp from a JPEG image using exiftool
 */
export async function extractExif(
  imagePath: string
): Promise<{ lat: number; lon: number; timestamp: string }> {
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
    ]);
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      throw new ExifToolUnavailableError();
    }
    throw new (Error as any)(`Failed to parse EXIF payload for ${imagePath}: ${error.message}`, {
      cause: error,
    });
  }

  const [latRes, lonRes, tsRes, offsetRes] = results;
  const latStr = latRes.stdout.trim();
  const lonStr = lonRes.stdout.trim();
  const tsStr = tsRes.stdout.trim();
  const offset = offsetRes.stdout.trim();

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
  const timestamp = offset ? `${tsStr}${offset}` : tsStr;

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

  return { lat, lon, timestamp };
}
