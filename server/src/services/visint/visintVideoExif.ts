const { execFile } = require('child_process');
const util = require('util');
const execFilePromise = util.promisify(execFile);
import { ExifMissingError, ExifToolUnavailableError } from './visintExif';

export async function extractVideoTelemetry(
  videoPath: string,
  originalFilename: string
): Promise<{
  lat: number;
  lon: number;
  timestamp: string;
  media_type: string;
  timestamp_source: string;
  timestamp_is_start_estimate: boolean;
  duration_s: number;
}> {
  let stdout;
  try {
    const result = await execFilePromise('exiftool', [
      '-a',
      '-G1',
      '-s',
      '-j',
      '-n',
      '-api',
      'QuickTimeUTC=0',
      videoPath,
    ]);
    stdout = result.stdout;
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      throw new ExifToolUnavailableError();
    }
    throw new (Error as any)(`Failed to parse EXIF payload for ${videoPath}: ${error.message}`, {
      cause: error,
    });
  }

  let metadata: any;
  try {
    metadata = JSON.parse(stdout)[0];
  } catch (e: any) {
    throw new (Error as any)(`Failed to parse exiftool JSON output for ${videoPath}`, { cause: e });
  }

  const lat = metadata['Composite:GPSLatitude'];
  const lon = metadata['Composite:GPSLongitude'];
  const duration = metadata['QuickTime:Duration'] || 0;
  const createDateStr = metadata['QuickTime:CreateDate'] || metadata['Keys:CreationTime'];
  const utcOffset = metadata['Keys:AndroidTimeZone'] || metadata['Keys:SamsungAndroidUtcOffset'];

  const missingFields: string[] = [];
  if (lat === undefined || lat === null) {
    missingFields.push('GPSLatitude');
  }
  if (lon === undefined || lon === null) {
    missingFields.push('GPSLongitude');
  }

  if (missingFields.length > 0) {
    throw new ExifMissingError(`Missing EXIF telemetry fields: ${missingFields.join(', ')}`);
  }

  const latNum = parseFloat(lat);
  const lonNum = parseFloat(lon);

  if (isNaN(latNum) || isNaN(lonNum)) {
    throw new ExifMissingError(
      'Invalid coordinate format in EXIF fields: GPSLatitude, GPSLongitude'
    );
  }

  // 1) Try container creation time
  let timestamp: string | null = null;
  let timestamp_source = '';
  let timestamp_is_start_estimate = false;

  if (createDateStr && createDateStr !== '0000:00:00 00:00:00') {
    // Format could be "YYYY:MM:DD HH:MM:SS" (UTC) or ISO 8601
    const isoStr = createDateStr.replace(/^(\d{4}):(\d{2}):(\d{2}) /, '$1-$2-$3T');
    const finalIso =
      isoStr.endsWith('Z') || isoStr.includes('+') || isoStr.match(/-\d{2}:?\d{2}$/)
        ? isoStr
        : `${isoStr}Z`;

    const dateObj = new Date(finalIso);

    if (!isNaN(dateObj.getTime())) {
      if (duration > 0) {
        // Subtract duration to get start estimate
        dateObj.setMilliseconds(dateObj.getMilliseconds() - duration * 1000);
        timestamp = dateObj.toISOString();
        timestamp_source = 'container_creation_minus_duration';
        timestamp_is_start_estimate = true;
      } else {
        timestamp = dateObj.toISOString();
        timestamp_source = 'container_creation';
      }
    }
  }

  // 2) Fallback to filename with utc_offset
  if (!timestamp && originalFilename) {
    // Matches YYYYMMDD_HHMMSS
    const match = originalFilename.match(/(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/);
    if (match) {
      if (!utcOffset) {
        throw new ExifMissingError(
          'Missing EXIF telemetry fields: DateTimeOriginal (tried container creation_time, filename fallback rejected due to missing utc_offset)'
        );
      }

      const [, y, m, d, h, min, s] = match;
      // Construct ISO string with offset
      // e.g. utcOffset is "-0400" or "-04:00"
      let formattedOffset = utcOffset;
      if (formattedOffset.length === 5 && !formattedOffset.includes(':')) {
        formattedOffset = `${formattedOffset.slice(0, 3)}:${formattedOffset.slice(3)}`; // "-0400" -> "-04:00"
      }

      const filenameDateStr = `${y}-${m}-${d}T${h}:${min}:${s}${formattedOffset}`;
      const dateObj = new Date(filenameDateStr);
      if (!isNaN(dateObj.getTime())) {
        timestamp = dateObj.toISOString();
        timestamp_source = 'filename_with_offset';
      }
    }
  }

  if (!timestamp) {
    throw new ExifMissingError(
      'Missing EXIF telemetry fields: DateTimeOriginal (tried container creation_time, filename+utc_offset)'
    );
  }

  return {
    lat: latNum,
    lon: lonNum,
    timestamp,
    media_type: 'video',
    timestamp_source,
    timestamp_is_start_estimate,
    duration_s: parseFloat(duration),
  };
}
