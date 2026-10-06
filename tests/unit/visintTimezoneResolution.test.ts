import request from 'supertest';
import express from 'express';
import {
  resolveImageCaptureInstant,
  parseExifOffset,
  parseGpsClockInstant,
  parseWallClockParts,
  resolveWallClockWithIanaZone,
  isLeapYear,
  isValidCalendarDate,
  formatDefaultZoneProvenance,
  isValidIso8601Instant,
  VisintInvalidTimestampError,
} from '../../server/src/services/visint/visintTimezone';
import { queryCorrelatedObservations } from '../../server/src/services/visint/visintScorer';
import { insertNetworkMedia } from '../../server/src/repositories/adminNetworkMediaRepository';

const mockObservationService = {
  saveVisINTAttachment: jest.fn().mockResolvedValue(['VISINT_VERIFIED']),
  correlateVisINT: jest.fn().mockResolvedValue({
    status: 'MATCHED',
    observation_id: '1',
    detection_score: 3,
    dist_meters: 10,
    delta_minutes: 1,
    tags_applied: ['VISINT_VERIFIED'],
    exif: { lat: 43.0, lon: -83.0, ts: '2026-05-07T00:29:10.000Z' },
    candidates: [],
  }),
};

jest.mock('../../server/src/config/container', () => ({
  observationService: mockObservationService,
}));
jest.mock('../../server/src/services/adminDbService', () => ({
  adminQuery: jest.fn(),
}));
jest.mock('../../server/src/config/database', () => ({
  query: jest.fn(),
}));

const { adminQuery } = require('../../server/src/services/adminDbService');
const { query } = require('../../server/src/config/database');

describe('VisINT Timezone Normalization and Resolution', () => {
  describe('A1: IANA Resolver and DST Edge Handling', () => {
    it('resolves nonexistent local time in spring-forward gap using pre-transition offset', () => {
      // 2026-03-08 02:30 America/Detroit is in the spring-forward gap (02:00 -> 03:00)
      // Pre-transition offset is EST (-05:00 = -300 minutes).
      // 02:30 - (-05:00) = 07:30 UTC -> 2026-03-08T07:30:00.000Z
      const parts = { year: 2026, month: 3, day: 8, hour: 2, minute: 30, second: 0 };
      const resolved = resolveWallClockWithIanaZone(parts, 'America/Detroit');
      expect(resolved).toBe('2026-03-08T07:30:00.000Z');

      const fullResolution = resolveImageCaptureInstant('2026-03-08 02:30:00', null, {
        defaultZone: 'America/Detroit',
      });
      expect(fullResolution).toEqual({
        timestamp: '2026-03-08T07:30:00.000Z',
        timestamp_source: 'default_america_detroit',
      });
    });

    it('resolves ambiguous local time in fall-back overlap using earlier occurrence', () => {
      // 2026-11-01 01:30 America/Detroit occurs twice:
      // Earlier occurrence is EDT (-04:00): 01:30 - (-04:00) = 05:30 UTC -> 2026-11-01T05:30:00.000Z
      // Later occurrence is EST (-05:00): 01:30 - (-05:00) = 06:30 UTC -> 2026-11-01T06:30:00.000Z
      // Rule A1: earlier occurrence must be chosen
      const parts = { year: 2026, month: 11, day: 1, hour: 1, minute: 30, second: 0 };
      const resolved = resolveWallClockWithIanaZone(parts, 'America/Detroit');
      expect(resolved).toBe('2026-11-01T05:30:00.000Z');

      const fullResolution = resolveImageCaptureInstant('2026-11-01 01:30:00', null, {
        defaultZone: 'America/Detroit',
      });
      expect(fullResolution).toEqual({
        timestamp: '2026-11-01T05:30:00.000Z',
        timestamp_source: 'default_america_detroit',
      });
    });

    it('resolves standard non-DST and DST dates deterministically', () => {
      // Winter: EST (UTC-5)
      const winter = resolveImageCaptureInstant('2026-01-15 12:00:00', null, {
        defaultZone: 'America/Detroit',
      });
      expect(winter).toEqual({
        timestamp: '2026-01-15T17:00:00.000Z',
        timestamp_source: 'default_america_detroit',
      });

      // Summer: EDT (UTC-4)
      const summer = resolveImageCaptureInstant('2026-07-15 12:00:00', null, {
        defaultZone: 'America/Detroit',
      });
      expect(summer).toEqual({
        timestamp: '2026-07-15T16:00:00.000Z',
        timestamp_source: 'default_america_detroit',
      });
    });
  });

  describe('Fallback Hierarchy & Provenance Tracking', () => {
    it('preserves direct ISO timestamps without modification', () => {
      const resZ = resolveImageCaptureInstant('2026-05-07T00:29:10.000Z');
      expect(resZ).toEqual({
        timestamp: '2026-05-07T00:29:10.000Z',
        timestamp_source: 'direct_iso',
      });

      const resOffset = resolveImageCaptureInstant('2026-05-06T20:29:10-04:00');
      expect(resOffset).toEqual({
        timestamp: '2026-05-07T00:29:10.000Z',
        timestamp_source: 'direct_iso',
      });
    });

    it('prioritizes OffsetTimeOriginal over OffsetTime and GPS', () => {
      const res = resolveImageCaptureInstant('2026-05-06 20:29:10', '+02:00', {
        offsetTime: '-04:00',
        gpsDate: '2026:05:07',
        gpsTime: '00:29:10',
        lon: -83.696,
      });
      expect(res).toEqual({
        timestamp: '2026-05-06T18:29:10.000Z',
        timestamp_source: 'exif_offset_original',
      });
    });

    it('falls back to OffsetTime when OffsetTimeOriginal is absent', () => {
      const res = resolveImageCaptureInstant('2026-05-06 20:29:10', null, {
        offsetTime: '-04:00',
        gpsDate: '2026:05:07',
        gpsTime: '00:29:10',
        lon: -83.696,
      });
      expect(res).toEqual({
        timestamp: '2026-05-07T00:29:10.000Z',
        timestamp_source: 'exif_offset_time',
      });
    });

    it('falls back to GPS clock differential when EXIF offset tags are absent', () => {
      const res = resolveImageCaptureInstant('2026-05-06 20:29:10', null, {
        gpsDate: '2026:05:07',
        gpsTime: '00:29:10',
        lon: -83.696,
      });
      expect(res).toEqual({
        timestamp: '2026-05-07T00:29:10.000Z',
        timestamp_source: 'exif_gps_derived',
      });
    });
  });

  describe('A5: GPS Longitude Plausibility Guard', () => {
    it('accepts GPS offset when within 180 minutes of solar longitude offset', () => {
      // lon = -83.696 -> solar offset = round(-83.696 * 4) = -335 minutes
      // GPS derived offset = -240 minutes (EDT, UTC-4)
      // |-240 - (-335)| = 95 minutes <= 180 minutes -> ACCEPTED
      const res = resolveImageCaptureInstant('2026-05-06 20:29:10', null, {
        gpsDate: '2026:05:07',
        gpsTime: '00:29:10',
        lon: -83.696,
      });
      expect(res).toEqual({
        timestamp: '2026-05-07T00:29:10.000Z',
        timestamp_source: 'exif_gps_derived',
      });
    });

    it('rejects GPS offset when implausible for longitude (>180m solar diff) and falls back to default zone', () => {
      // lon = 100.0 (Asia/Bangkok area) -> solar offset = round(100 * 4) = +400 minutes
      // Wall clock set to EDT (-240 minutes) gives diff with solar of |-240 - 400| = 640 > 180 minutes
      // Should REJECT GPS offset and fall back to default zone
      const res = resolveImageCaptureInstant('2026-05-06 20:29:10', null, {
        gpsDate: '2026:05:07',
        gpsTime: '00:29:10',
        lon: 100.0,
      });
      expect(res).toEqual({
        timestamp: '2026-05-07T00:29:10.000Z',
        timestamp_source: 'default_america_detroit',
      });
    });
  });

  describe('A6: Stale GPS Rejection', () => {
    it('rejects stale GPS clock with non-timezone residual (>5 min) and falls back to default zone', () => {
      // Wall: 2026-05-06 20:29:10
      // GPS:  2026:05:07 00:23:00
      // Diff: -233.833 minutes. Closest 15m step: -240m. Residual: ~6.2 min > 5 min -> REJECTED
      const res = resolveImageCaptureInstant('2026-05-06 20:29:10', null, {
        gpsDate: '2026:05:07',
        gpsTime: '00:23:00',
        lon: -83.696,
      });
      expect(res).toEqual({
        timestamp: '2026-05-07T00:29:10.000Z',
        timestamp_source: 'default_america_detroit',
      });
    });
  });

  describe('Process Environment Independence', () => {
    const originalTz = process.env.TZ;

    afterEach(() => {
      process.env.TZ = originalTz;
    });

    it('produces identical normalized outputs regardless of process.env.TZ', () => {
      const wallStr = '2026-05-06 20:29:10';

      process.env.TZ = 'UTC';
      const utcRes = resolveImageCaptureInstant(wallStr);

      process.env.TZ = 'America/Los_Angeles';
      const laRes = resolveImageCaptureInstant(wallStr);

      process.env.TZ = 'Asia/Tokyo';
      const tokyoRes = resolveImageCaptureInstant(wallStr);

      expect(utcRes).toEqual(laRes);
      expect(laRes).toEqual(tokyoRes);
      expect(utcRes.timestamp).toBe('2026-05-07T00:29:10.000Z');
      expect(utcRes.timestamp_source).toBe('default_america_detroit');
    });
  });

  describe('A2 & A6: Scorer Validation & Time Window Midpoint', () => {
    it('throws when scorer is passed a bare wall-clock timestamp string', async () => {
      const mockQueryFn = jest.fn();
      await expect(
        queryCorrelatedObservations(mockQueryFn, -83.696, 43.023, '2026-05-06 20:29:10')
      ).rejects.toThrow(/Scorer requires ISO-8601 instant with trailing Z or offset/);
      expect(mockQueryFn).not.toHaveBeenCalled();
    });

    it('accepts ISO-8601 string with Z or offset in scorer', async () => {
      const mockQueryFn = jest.fn().mockResolvedValue({ rows: [] });
      await expect(
        queryCorrelatedObservations(mockQueryFn, -83.696, 43.023, '2026-05-07T00:29:10.000Z')
      ).resolves.toEqual([]);
      expect(mockQueryFn).toHaveBeenCalled();
    });

    it('A6: produces symmetric window where midpoint equals timestamp when mediaDurationS = 0', async () => {
      let _capturedSql = '';
      let capturedParams: any[] = [];
      const mockQueryFn = jest.fn().mockImplementation((sql, params) => {
        _capturedSql = sql;
        capturedParams = params;
        return Promise.resolve({ rows: [] });
      });

      const ts = '2026-05-07T00:00:00.000Z';
      const baseMs = new Date(ts).getTime();
      await queryCorrelatedObservations(mockQueryFn, -83.696, 43.023, ts, 50, 2, 5, 0);

      // Params: $5 is startTime, $6 is endTime
      const startMs = new Date(capturedParams[4]).getTime();
      const endMs = new Date(capturedParams[5]).getTime();

      expect(startMs).toBe(baseMs - 2 * 3600 * 1000);
      expect(endMs).toBe(baseMs + 2 * 3600 * 1000);
      const midpointMs = (startMs + endMs) / 2;
      expect(midpointMs).toBe(baseMs);
    });

    it('A6: produces asymmetric window where midpoint is shifted when mediaDurationS > 0', async () => {
      let capturedParams: any[] = [];
      const mockQueryFn = jest.fn().mockImplementation((_sql, params) => {
        capturedParams = params;
        return Promise.resolve({ rows: [] });
      });

      const ts = '2026-05-07T00:00:00.000Z';
      const baseMs = new Date(ts).getTime();
      const durationS = 120; // 2 minutes video
      await queryCorrelatedObservations(mockQueryFn, -83.696, 43.023, ts, 50, 2, 5, durationS);

      const startMs = new Date(capturedParams[4]).getTime();
      const endMs = new Date(capturedParams[5]).getTime();

      expect(startMs).toBe(baseMs - 2 * 3600 * 1000);
      expect(endMs).toBe(baseMs + 2 * 3600 * 1000 + durationS * 1000);

      const midpointMs = (startMs + endMs) / 2;
      // Midpoint is shifted by durationS / 2 seconds
      expect(midpointMs).toBe(baseMs + (durationS / 2) * 1000);
      expect(midpointMs).not.toBe(baseMs);
    });
  });

  describe('A7: Repository Parameter Order & $21 Placeholder', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('asserts insertNetworkMedia passes all 21 parameters in exact order', async () => {
      (query as jest.Mock).mockResolvedValueOnce({ rows: [] }); // duplicate check
      (adminQuery as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: 42, filename: 'photo.jpg', file_size: 100, created_at: new Date() }],
      });

      const buffer = Buffer.from('photo-bytes');
      const rawJson = { tags: { Make: 'Nikon' } };

      await insertNetworkMedia(
        '11:22:33:44:55:66',
        'image',
        'photo.jpg',
        buffer.length,
        'image/jpeg',
        buffer,
        'Test desc',
        43.023,
        -83.696,
        '2026-05-07T00:29:10.000Z',
        null,
        12345,
        rawJson,
        'Nikon',
        'Z9',
        150.2,
        45.0,
        1920,
        1080,
        'exif_offset_original'
      );

      expect(adminQuery).toHaveBeenCalledTimes(1);
      const [sql, params] = (adminQuery as jest.Mock).mock.calls[0];

      // Verify SQL contains timestamp_source and $21 placeholder
      expect(sql).toContain('timestamp_source');
      expect(sql).toContain(
        "VALUES ($1, $2, $3, $4, $5, $6, $7, 'admin', $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)"
      );

      // Verify exact parameter mapping
      expect(params).toHaveLength(21);
      expect(params[0]).toBe('11:22:33:44:55:66'); // $1 bssid
      expect(params[1]).toBe('image'); // $2 media_type
      expect(params[2]).toBe('photo.jpg'); // $3 filename
      expect(params[3]).toBe(buffer.length); // $4 file_size
      expect(params[4]).toBe('image/jpeg'); // $5 mime_type
      expect(params[5]).toBe(buffer); // $6 media_data
      expect(params[6]).toBe('Test desc'); // $7 description
      // ('admin' is literal in SQL)
      expect(params[7]).toBe(43.023); // $8 exif_lat
      expect(params[8]).toBe(-83.696); // $9 exif_lon
      expect(params[9]).toBe('2026-05-07T00:29:10.000Z'); // $10 exif_captured_at
      expect(params[10]).toBeNull(); // $11 thumbnail
      expect(params[11]).toBe(12345); // $12 observation_id
      expect(params[12]).toHaveLength(64); // $13 image_sha256
      expect(params[13]).toBe(JSON.stringify(rawJson)); // $14 exif_raw
      expect(params[14]).toBe('Nikon'); // $15 exif_make
      expect(params[15]).toBe('Z9'); // $16 exif_model
      expect(params[16]).toBe(150.2); // $17 exif_altitude
      expect(params[17]).toBe(45.0); // $18 exif_bearing
      expect(params[18]).toBe(1920); // $19 exif_width
      expect(params[19]).toBe(1080); // $20 exif_height
      expect(params[20]).toBe('exif_offset_original'); // $21 timestamp_source
    });
  });

  describe('Helper Parsing Functions', () => {
    it('parses various EXIF offset formats correctly', () => {
      expect(parseExifOffset('+04:00')).toBe(240);
      expect(parseExifOffset('-05:00')).toBe(-300);
      expect(parseExifOffset('+0430')).toBe(270);
      expect(parseExifOffset('-03')).toBe(-180);
      expect(parseExifOffset('+00:00')).toBe(0);
      expect(parseExifOffset('invalid')).toBeNull();
      expect(parseExifOffset(null)).toBeNull();
    });

    it('parses wall clock parts with dashes or colons', () => {
      expect(parseWallClockParts('2026:05:06 20:29:10')).toEqual({
        year: 2026,
        month: 5,
        day: 6,
        hour: 20,
        minute: 29,
        second: 10,
      });
      expect(parseWallClockParts('2026-05-06 20:29:10')).toEqual({
        year: 2026,
        month: 5,
        day: 6,
        hour: 20,
        minute: 29,
        second: 10,
      });
      expect(parseWallClockParts('not a date')).toBeNull();
    });

    it('parses GPS clock date and time fields to UTC instant', () => {
      const instant = parseGpsClockInstant('2026:05:07', '00:29:10');
      expect(instant?.toISOString()).toBe('2026-05-07T00:29:10.000Z');

      const instantWithMs = parseGpsClockInstant('2026-05-07', '00:29:10.500Z');
      expect(instantWithMs?.toISOString()).toBe('2026-05-07T00:29:10.500Z');

      expect(parseGpsClockInstant(null, '00:29:10')).toBeNull();
    });
  });

  describe('A2: Ingress API and Route-Level Validation on VisINT Endpoints', () => {
    const app = express();
    app.use(express.json());
    const observationsRouter =
      require('../../server/src/api/routes/v1/networks/observations').default;
    app.use('/', observationsRouter);

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('rejects bare wall-clock timestamp string with HTTP 400 and VISINT_INVALID_TIMESTAMP', async () => {
      const image = Buffer.from('fake-image-bytes');
      const res = await request(app)
        .post('/observations/attach-visint')
        .attach('image', image, 'test.jpg')
        .field('bssid', 'AA:BB:CC:DD:EE:FF')
        .field('status', 'MATCHED')
        .field('ts', '2026-05-06 20:29:10');

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VISINT_INVALID_TIMESTAMP');
      expect(res.body.error).toContain('Expected ISO-8601 with timezone offset');
    });

    it('rejects 2026-02-30T12:00:00Z in body.ts with HTTP 400 and VISINT_INVALID_TIMESTAMP on attach-visint', async () => {
      const image = Buffer.from('fake-image-bytes');
      const res = await request(app)
        .post('/observations/attach-visint')
        .attach('image', image, 'test.jpg')
        .field('bssid', 'AA:BB:CC:DD:EE:FF')
        .field('status', 'MATCHED')
        .field('ts', '2026-02-30T12:00:00Z');

      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.code).toBe('VISINT_INVALID_TIMESTAMP');
      expect(res.body.error).toContain('Expected ISO-8601 with timezone offset');
      expect(mockObservationService.saveVisINTAttachment).not.toHaveBeenCalled();
    });

    it('accepts valid ISO-8601 timestamp string with Z or offset on attach-visint (valid input unchanged)', async () => {
      mockObservationService.saveVisINTAttachment.mockResolvedValueOnce(['VISINT_VERIFIED']);
      const image = Buffer.from('fake-image-bytes');
      const res = await request(app)
        .post('/observations/attach-visint')
        .attach('image', image, 'test.jpg')
        .field('bssid', 'AA:BB:CC:DD:EE:FF')
        .field('status', 'MATCHED')
        .field('ts', '2026-05-07T00:29:10.000Z');

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.success).toBe(true);
      expect(res.body.tags_applied).toEqual(['VISINT_VERIFIED']);
    });

    it('rejects impossible EXIF date with HTTP 400 and VISINT_INVALID_TIMESTAMP on correlate-visint', async () => {
      mockObservationService.correlateVisINT.mockRejectedValueOnce(
        new VisintInvalidTimestampError(
          'Invalid wall-clock timestamp format: "2026-02-30 12:00:00"'
        )
      );
      const image = Buffer.from('fake-image-bytes');
      const res = await request(app)
        .post('/observations/correlate-visint')
        .attach('image', image, 'impossible_date.jpg');

      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.code).toBe('VISINT_INVALID_TIMESTAMP');
      expect(res.body.error).toBe('Invalid wall-clock timestamp format: "2026-02-30 12:00:00"');
    });

    it('rejects 0000:00:00 EXIF date with HTTP 400 and VISINT_INVALID_TIMESTAMP on correlate-visint', async () => {
      mockObservationService.correlateVisINT.mockRejectedValueOnce(
        new VisintInvalidTimestampError(
          'Invalid wall-clock timestamp format: "0000:00:00 00:00:00"'
        )
      );
      const image = Buffer.from('fake-image-bytes');
      const res = await request(app)
        .post('/observations/correlate-visint')
        .attach('image', image, 'zeroed_date.jpg');

      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.code).toBe('VISINT_INVALID_TIMESTAMP');
      expect(res.body.error).toBe('Invalid wall-clock timestamp format: "0000:00:00 00:00:00"');
    });

    it('accepts valid input unchanged on correlate-visint (HTTP 200)', async () => {
      mockObservationService.correlateVisINT.mockResolvedValueOnce({
        status: 'MATCHED',
        observation_id: '1',
        detection_score: 3,
        dist_meters: 10,
        delta_minutes: 1,
        tags_applied: ['VISINT_VERIFIED'],
        exif: { lat: 43.0, lon: -83.0, ts: '2026-05-07T00:29:10.000Z' },
        candidates: [],
      });
      const image = Buffer.from('fake-image-bytes');
      const res = await request(app)
        .post('/observations/correlate-visint')
        .attach('image', image, 'valid.jpg');

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.status).toBe('MATCHED');
    });

    it('rejects attach-visint with HTTP 400 and VISINT_INVALID_TIMESTAMP when service throws VisintInvalidTimestampError', async () => {
      mockObservationService.saveVisINTAttachment.mockRejectedValueOnce(
        new VisintInvalidTimestampError(
          'Invalid wall-clock timestamp format: "2026-02-30 12:00:00"'
        )
      );
      const image = Buffer.from('fake-image-bytes');
      const res = await request(app)
        .post('/observations/attach-visint')
        .attach('image', image, 'bad_exif.jpg')
        .field('bssid', 'AA:BB:CC:DD:EE:FF')
        .field('status', 'MATCHED');

      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.code).toBe('VISINT_INVALID_TIMESTAMP');
      expect(res.body.error).toBe('Invalid wall-clock timestamp format: "2026-02-30 12:00:00"');
    });
  });

  describe('Calendar Validation & Date Rollover Prevention', () => {
    it('correctly identifies leap years', () => {
      expect(isLeapYear(2024)).toBe(true);
      expect(isLeapYear(2000)).toBe(true);
      expect(isLeapYear(2026)).toBe(false);
      expect(isLeapYear(2100)).toBe(false);
    });

    it('rejects invalid calendar dates: 02-30, 02-29 in non-leap year, 04-31, month 13, day 00', () => {
      expect(isValidCalendarDate(2026, 2, 30)).toBe(false);
      expect(isValidCalendarDate(2026, 2, 29)).toBe(false);
      expect(isValidCalendarDate(2024, 2, 29)).toBe(true);
      expect(isValidCalendarDate(2026, 4, 31)).toBe(false);
      expect(isValidCalendarDate(2026, 13, 1)).toBe(false);
      expect(isValidCalendarDate(2026, 5, 0)).toBe(false);

      // 02-30
      expect(() => resolveImageCaptureInstant('2026-02-30 12:00:00')).toThrow(
        /Invalid wall-clock timestamp format/
      );
      // 02-29 in non-leap year (2025 or 2026)
      expect(() => resolveImageCaptureInstant('2026-02-29 12:00:00')).toThrow(
        /Invalid wall-clock timestamp format/
      );
      expect(() => resolveImageCaptureInstant('2025-02-29 12:00:00')).toThrow(
        /Invalid wall-clock timestamp format/
      );
      // 04-31 (April has 30 days)
      expect(() => resolveImageCaptureInstant('2026-04-31 12:00:00')).toThrow(
        /Invalid wall-clock timestamp format/
      );
      // month 13
      expect(() => resolveImageCaptureInstant('2026-13-01 12:00:00')).toThrow(
        /Invalid wall-clock timestamp format/
      );
      // day 00
      expect(() => resolveImageCaptureInstant('2026-05-00 12:00:00')).toThrow(
        /Invalid wall-clock timestamp format/
      );

      // Also verify parseWallClockParts returns null directly
      expect(parseWallClockParts('2026-02-30 12:00:00')).toBeNull();
      expect(parseWallClockParts('2026-02-29 12:00:00')).toBeNull();
      expect(parseWallClockParts('2026-04-31 12:00:00')).toBeNull();
      expect(parseWallClockParts('2026-13-01 12:00:00')).toBeNull();
      expect(parseWallClockParts('2026-05-00 12:00:00')).toBeNull();
    });

    it('accepts 02-29 in a leap year', () => {
      // 2024 is a leap year
      const leapYearResolution = resolveImageCaptureInstant('2024-02-29 12:00:00');
      expect(leapYearResolution).toEqual({
        timestamp: '2024-02-29T17:00:00.000Z',
        timestamp_source: 'default_america_detroit',
      });
      expect(parseWallClockParts('2024-02-29 12:00:00')).toEqual({
        year: 2024,
        month: 2,
        day: 29,
        hour: 12,
        minute: 0,
        second: 0,
      });
    });

    it('rejects invalid calendar dates in direct ISO format to prevent Date rollover', () => {
      expect(() => resolveImageCaptureInstant('2026-02-30T12:00:00.000Z')).toThrow(
        /Invalid wall-clock timestamp format/
      );
      expect(() => resolveImageCaptureInstant('2026-04-31T12:00:00-04:00')).toThrow(
        /Invalid wall-clock timestamp format/
      );
    });

    it('rejects 0000:00:00 zeroed EXIF timestamps with VisintInvalidTimestampError', () => {
      expect(() => resolveImageCaptureInstant('0000:00:00 00:00:00')).toThrow(
        VisintInvalidTimestampError
      );
      expect(() => resolveImageCaptureInstant('0000:00:00 00:00:00')).toThrow(
        /Invalid wall-clock timestamp format/
      );
      expect(() => resolveImageCaptureInstant('0000-00-00 00:00:00')).toThrow(
        VisintInvalidTimestampError
      );
      expect(() => resolveImageCaptureInstant('0000:00:00')).toThrow(VisintInvalidTimestampError);
    });

    it('rejects impossible EXIF date with VisintInvalidTimestampError', () => {
      expect(() => resolveImageCaptureInstant('2026-02-30 12:00:00')).toThrow(
        VisintInvalidTimestampError
      );
      expect(() => resolveImageCaptureInstant('2026-02-30T12:00:00Z')).toThrow(
        VisintInvalidTimestampError
      );
    });

    it.each([
      '2026-01-01T25:00:00Z',
      '2026-01-01T12:60:00Z',
      '2026-01-01T12:00:60Z',
      '2026-01-01T12:00:00+25:00',
      '2026-01-01T12:00:00+05:99',
      '2026-01-01T12:00:00+14:01',
    ])('rejects invalid time or offset components consistently: %s', (timestamp) => {
      expect(isValidIso8601Instant(timestamp)).toBe(false);
      expect(() => resolveImageCaptureInstant(timestamp)).toThrow(VisintInvalidTimestampError);
    });

    it('accepts the largest valid timezone offset and a valid clock time', () => {
      const timestamp = '2026-01-01T23:59:59+14:00';
      expect(isValidIso8601Instant(timestamp)).toBe(true);
      expect(resolveImageCaptureInstant(timestamp)).toEqual({
        timestamp: '2026-01-01T09:59:59.000Z',
        timestamp_source: 'direct_iso',
      });
    });
  });

  describe('Custom options.defaultZone and Provenance Derivation', () => {
    it('produces matching timestamp_source for custom defaultZone', () => {
      const chicagoRes = resolveImageCaptureInstant('2026-05-06 20:29:10', null, {
        defaultZone: 'America/Chicago',
      });
      expect(chicagoRes.timestamp_source).toBe('default_america_chicago');
      expect(chicagoRes.timestamp).toBe('2026-05-07T01:29:10.000Z');

      const laRes = resolveImageCaptureInstant('2026-05-06 20:29:10', null, {
        defaultZone: 'America/Los_Angeles',
      });
      expect(laRes.timestamp_source).toBe('default_america_los_angeles');
      expect(laRes.timestamp).toBe('2026-05-07T03:29:10.000Z');

      const utcRes = resolveImageCaptureInstant('2026-05-06 20:29:10', null, {
        defaultZone: 'UTC',
      });
      expect(utcRes.timestamp_source).toBe('default_utc');
      expect(utcRes.timestamp).toBe('2026-05-06T20:29:10.000Z');
    });

    it('preserves default_america_detroit when defaultZone is omitted or America/Detroit', () => {
      const omittedRes = resolveImageCaptureInstant('2026-05-06 20:29:10');
      expect(omittedRes.timestamp_source).toBe('default_america_detroit');

      const explicitRes = resolveImageCaptureInstant('2026-05-06 20:29:10', null, {
        defaultZone: 'America/Detroit',
      });
      expect(explicitRes.timestamp_source).toBe('default_america_detroit');
    });

    it('slugs special characters and caps overlong zone names within 50 characters', () => {
      expect(formatDefaultZoneProvenance('Etc/GMT+4')).toBe('default_etc_gmt_4');
      const longZone = 'America/Argentina/VeryLongLocationNameThatExceedsTheFiftyCharacterLimit';
      const formatted = formatDefaultZoneProvenance(longZone);
      expect(formatted.length).toBeLessThanOrEqual(50);
      expect(formatted.startsWith('default_')).toBe(true);
    });
  });
});
