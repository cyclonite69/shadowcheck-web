/**
 * VisINT Timezone and Timestamp Normalization Service
 *
 * Implements deterministic single-pass normalization of media capture timestamps
 * into UTC ISO-8601 instants, eliminating dual-runtime divergence between Node.js V8
 * and PostgreSQL session timezones.
 */

export interface ResolvedTimestamp {
  timestamp: string;
  timestamp_source:
    | 'direct_iso'
    | 'exif_offset_original'
    | 'exif_offset_time'
    | 'exif_gps_derived'
    | 'default_america_detroit'
    | `default_${string}`;
}

export interface ResolveTimestampOptions {
  lat?: number | null;
  lon?: number | null;
  offsetTime?: string | null;
  gpsDate?: string | null;
  gpsTime?: string | null;
  defaultZone?: string;
}

export class VisintInvalidTimestampError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VisintInvalidTimestampError';
  }
}

const ISO_8601_OFFSET_REGEX =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|([+-])(\d{2}):?(\d{2}))$/;

/**
 * Validates a complete ISO-8601 instant using the same calendar, clock, and
 * timezone-offset limits used by timestamp resolution.
 */
export function isValidIso8601Instant(value: string): boolean {
  const match = value.match(ISO_8601_OFFSET_REGEX);
  if (!match) {
    return false;
  }

  const [
    ,
    yearText,
    monthText,
    dayText,
    hourText,
    minuteText,
    secondText,
    ,
    ,
    offsetHourText,
    offsetMinuteText,
  ] = match;
  const year = parseInt(yearText, 10);
  const month = parseInt(monthText, 10);
  const day = parseInt(dayText, 10);
  const hour = parseInt(hourText, 10);
  const minute = parseInt(minuteText, 10);
  const second = parseInt(secondText, 10);

  if (!isValidCalendarDate(year, month, day) || hour > 23 || minute > 59 || second > 59) {
    return false;
  }

  if (offsetHourText !== undefined) {
    const offsetHour = parseInt(offsetHourText, 10);
    const offsetMinute = parseInt(offsetMinuteText, 10);
    if (offsetHour > 14 || offsetMinute > 59 || (offsetHour === 14 && offsetMinute !== 0)) {
      return false;
    }
  }

  return !isNaN(new Date(value).getTime());
}

/**
 * Parses an EXIF offset string such as "+04:00", "-05:00", "+0400", or "-05" into total minutes.
 * Returns null if the format is invalid.
 */
export function parseExifOffset(offsetStr: string | null | undefined): number | null {
  if (!offsetStr) {
    return null;
  }
  const match = offsetStr.trim().match(/^([+-])(\d{1,2}):?(\d{2})?$/);
  if (!match) {
    return null;
  }

  const sign = match[1] === '-' ? -1 : 1;
  const hours = parseInt(match[2], 10);
  const minutes = match[3] ? parseInt(match[3], 10) : 0;
  if (hours > 14 || minutes > 59) {
    return null;
  }

  return sign * (hours * 60 + minutes);
}

/**
 * Checks whether a given year is a leap year in the Gregorian calendar.
 */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Validates day-of-month against month and year (including leap years).
 */
export function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12) {
    return false;
  }
  if (day < 1) {
    return false;
  }
  const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= daysInMonth[month - 1];
}

/**
 * Derives provenance label from IANA timezone.
 * 'America/Detroit' is preserved as 'default_america_detroit'.
 * Other zones are slugged as 'default_<slug>' and truncated to 50 chars for varchar(50).
 */
export function formatDefaultZoneProvenance(zone?: string | null): `default_${string}` {
  if (!zone) {
    return 'default_america_detroit';
  }
  const normalized = zone.trim().toLowerCase();
  if (normalized === 'america/detroit') {
    return 'default_america_detroit';
  }
  const slug = normalized.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const label = `default_${slug}`;
  return label.slice(0, 50) as `default_${string}`;
}

/**
 * Parses wall-clock date-time strings in "YYYY:MM:DD HH:MM:SS" or "YYYY-MM-DD HH:MM:SS".
 */
export function parseWallClockParts(
  wallClockStr: string
): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} | null {
  if (!wallClockStr) {
    return null;
  }
  const cleaned = wallClockStr.trim();
  const match = cleaned.match(/^(\d{4})[:-](\d{2})[:-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/);
  if (!match) {
    return null;
  }

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  const hour = parseInt(match[4], 10);
  const minute = parseInt(match[5], 10);
  const second = parseInt(match[6], 10);

  if (!isValidCalendarDate(year, month, day)) {
    return null;
  }
  if (hour > 23 || minute > 59 || second > 59) {
    return null;
  }

  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
  };
}

/**
 * Parses GPS clock date and time fields into a UTC Date instant.
 * GPSDateStamp format: "YYYY:MM:DD" or "YYYY-MM-DD"
 * GPSTimeStamp format: "HH:MM:SS" or "HH:MM:SS.SSS" or "HH:MM:SSZ"
 */
export function parseGpsClockInstant(
  gpsDate: string | null | undefined,
  gpsTime: string | null | undefined
): Date | null {
  if (!gpsDate || !gpsTime) {
    return null;
  }
  const dateMatch = gpsDate.trim().match(/^(\d{4})[:-](\d{2})[:-](\d{2})$/);
  const timeMatch = gpsTime.trim().match(/^(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?Z?$/);
  if (!dateMatch || !timeMatch) {
    return null;
  }

  const year = parseInt(dateMatch[1], 10);
  const month = parseInt(dateMatch[2], 10) - 1;
  const day = parseInt(dateMatch[3], 10);

  if (!isValidCalendarDate(year, month + 1, day)) {
    return null;
  }

  const hour = parseInt(timeMatch[1], 10);
  const minute = parseInt(timeMatch[2], 10);
  const second = parseInt(timeMatch[3], 10);

  if (hour > 23 || minute > 59 || second > 59) {
    return null;
  }

  const ms = timeMatch[4] ? parseInt(timeMatch[4].padEnd(3, '0').slice(0, 3), 10) : 0;

  const utcMs = Date.UTC(year, month, day, hour, minute, second, ms);
  return new Date(utcMs);
}

/**
 * Calculates the timezone offset in minutes for a specific UTC instant in a given IANA time zone.
 * Offset in minutes = (localAsUtc - utcMs) / 60000.
 */
function getOffsetForUtcInstant(
  utcMs: number,
  timeZone: string
): { offsetMinutes: number; localMs: number } {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(new Date(utcMs));
  const partMap: Record<string, string> = {};
  for (const p of parts) {
    partMap[p.type] = p.value;
  }

  const year = parseInt(partMap.year, 10);
  const month = parseInt(partMap.month, 10) - 1;
  const day = parseInt(partMap.day, 10);
  let hour = parseInt(partMap.hour, 10);
  if (hour === 24) {
    hour = 0;
  }
  const minute = parseInt(partMap.minute, 10);
  const second = parseInt(partMap.second, 10);

  const localMs = Date.UTC(year, month, day, hour, minute, second);
  const offsetMinutes = Math.round((localMs - utcMs) / 60000);
  return { offsetMinutes, localMs };
}

/**
 * Resolves local wall-clock components against an IANA timezone with deterministic DST handling:
 * - Exact: single matching UTC instant.
 * - Nonexistent (spring-forward gap): uses the pre-transition offset.
 * - Ambiguous (fall-back overlap): uses the earlier occurrence.
 */
export function resolveWallClockWithIanaZone(
  parts: { year: number; month: number; day: number; hour: number; minute: number; second: number },
  timeZone: string = 'America/Detroit'
): string {
  const targetLocalMs = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );

  // Sample offsets around this date: 1 day prior, at target, and 1 day after
  const samples = [targetLocalMs - 86400000, targetLocalMs, targetLocalMs + 86400000];
  const uniqueOffsets = [
    ...new Set(samples.map((s) => getOffsetForUtcInstant(s, timeZone).offsetMinutes)),
  ];

  const validCandidates: { candidateUtcMs: number; offset: number }[] = [];
  for (const offset of uniqueOffsets) {
    const candidateUtcMs = targetLocalMs - offset * 60000;
    const { offsetMinutes: actualOffset, localMs } = getOffsetForUtcInstant(
      candidateUtcMs,
      timeZone
    );
    if (localMs === targetLocalMs && actualOffset === offset) {
      validCandidates.push({ candidateUtcMs, offset });
    }
  }

  if (validCandidates.length === 1) {
    return new Date(validCandidates[0].candidateUtcMs).toISOString();
  }

  if (validCandidates.length > 1) {
    // Ambiguous (fall-back): earlier occurrence is smaller UTC epoch ms
    validCandidates.sort((a, b) => a.candidateUtcMs - b.candidateUtcMs);
    return new Date(validCandidates[0].candidateUtcMs).toISOString();
  }

  // Nonexistent (spring-forward gap): use pre-transition offset (sampled 4 hours prior)
  const preTransitionOffset = getOffsetForUtcInstant(
    targetLocalMs - 4 * 3600000,
    timeZone
  ).offsetMinutes;
  return new Date(targetLocalMs - preTransitionOffset * 60000).toISOString();
}

/**
 * Primary timestamp resolver. Resolves image capture timestamp to a UTC ISO string
 * and provenance tag according to strict fallback hierarchy:
 * 1. Already valid ISO string with offset/Z -> 'direct_iso'
 * 2. OffsetTimeOriginal -> 'exif_offset_original'
 * 3. OffsetTime -> 'exif_offset_time'
 * 4. GPS clock with residual tolerance (<=5m) and longitude plausibility guard (<=180m) -> 'exif_gps_derived'
 * 5. Default IANA zone (America/Detroit) -> 'default_america_detroit'
 */
export function resolveImageCaptureInstant(
  wallClockStr: string,
  offsetOriginalStr?: string | null,
  options?: ResolveTimestampOptions
): ResolvedTimestamp {
  const trimmed = wallClockStr.trim();

  // 1. Direct ISO with offset / Z
  if (ISO_8601_OFFSET_REGEX.test(trimmed)) {
    if (!isValidIso8601Instant(trimmed)) {
      throw new VisintInvalidTimestampError(
        `Invalid wall-clock timestamp format: "${wallClockStr}"`
      );
    }
    return {
      timestamp: new Date(trimmed).toISOString(),
      timestamp_source: 'direct_iso',
    };
  }

  const parts = parseWallClockParts(trimmed);
  if (!parts) {
    throw new VisintInvalidTimestampError(`Invalid wall-clock timestamp format: "${wallClockStr}"`);
  }

  const localAsUtcMs = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );

  // 2. OffsetTimeOriginal
  const offsetOriginalMinutes = parseExifOffset(offsetOriginalStr);
  if (offsetOriginalMinutes !== null) {
    const utcMs = localAsUtcMs - offsetOriginalMinutes * 60000;
    return {
      timestamp: new Date(utcMs).toISOString(),
      timestamp_source: 'exif_offset_original',
    };
  }

  // 3. OffsetTime
  const offsetTimeMinutes = parseExifOffset(options?.offsetTime);
  if (offsetTimeMinutes !== null) {
    const utcMs = localAsUtcMs - offsetTimeMinutes * 60000;
    return {
      timestamp: new Date(utcMs).toISOString(),
      timestamp_source: 'exif_offset_time',
    };
  }

  // 4. GPS Clock Differential
  if (options?.gpsDate && options?.gpsTime) {
    const gpsUtc = parseGpsClockInstant(options.gpsDate, options.gpsTime);
    if (gpsUtc && !isNaN(gpsUtc.getTime())) {
      const diffMinutes = (localAsUtcMs - gpsUtc.getTime()) / 60000;
      const roundedOffsetMinutes = Math.round(diffMinutes / 15) * 15;
      const residual = Math.abs(diffMinutes - roundedOffsetMinutes);

      // Must be within 5 minutes of a standard 15-minute timezone boundary
      if (residual <= 5) {
        // Longitude plausibility guard: |roundedOffsetMinutes - round(lon/15*60)| <= 180
        let lonPlausible = true;
        if (options.lon !== undefined && options.lon !== null && !isNaN(options.lon)) {
          const solarOffsetMinutes = Math.round((options.lon / 15) * 60);
          if (Math.abs(roundedOffsetMinutes - solarOffsetMinutes) > 180) {
            lonPlausible = false;
          }
        }

        if (lonPlausible) {
          const utcMs = localAsUtcMs - roundedOffsetMinutes * 60000;
          return {
            timestamp: new Date(utcMs).toISOString(),
            timestamp_source: 'exif_gps_derived',
          };
        }
      }
    }
  }

  // 5. Default IANA zone (America/Detroit)
  const defaultZone = options?.defaultZone || 'America/Detroit';
  const resolvedIso = resolveWallClockWithIanaZone(parts, defaultZone);
  return {
    timestamp: resolvedIso,
    timestamp_source: formatDefaultZoneProvenance(defaultZone),
  };
}
