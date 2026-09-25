import request from 'supertest';
import express from 'express';

// Define mock container
const mockContainer = {
  observationService: {
    getHomeLocationForObservations: jest.fn(),
    getObservationsByBSSID: jest.fn().mockResolvedValue([]), // Default to empty array
    checkWigleTableExists: jest.fn(),
    getWigleObservationsByBSSID: jest.fn().mockResolvedValue([]),
    getOurObservationCount: jest.fn().mockResolvedValue(0),
    getWigleObservationsBatch: jest.fn().mockResolvedValue([]),
    correlateVisINT: jest.fn(),
    saveVisINTAttachment: jest.fn(),
  },
};

// Mock the container
jest.mock('../../../../server/src/config/container', () => mockContainer);

// Mock logger
jest.mock('../../../../server/src/logging/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  default: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Use commonjs require and handle possible .default from ts-node/esm
const observationsModule = require('../../../../server/src/api/routes/v1/networks/observations');
const observationsRouter = observationsModule.default || observationsModule;

const app = express();
app.use(express.json());
// Mounted at /api
app.use('/api', observationsRouter);

describe('Observations API v1', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Re-apply defaults after clear
    mockContainer.observationService.getObservationsByBSSID.mockResolvedValue([]);
  });

  describe('GET /api/networks/observations/:bssid', () => {
    it('should return observations for a valid BSSID', async () => {
      const bssid = '00:11:22:33:44:55';
      const mockHome = { lon: -122.4194, lat: 37.7749 };
      const mockObservations = [
        {
          id: 1,
          bssid,
          ssid: 'TestNet',
          lat: 37.775,
          lon: -122.419,
          level: -50,
          time: 1600000000000,
        },
      ];

      mockContainer.observationService.getHomeLocationForObservations.mockResolvedValue(mockHome);
      mockContainer.observationService.getObservationsByBSSID.mockResolvedValue(mockObservations);

      const res = await request(app).get(`/api/networks/observations/${bssid}`);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.bssid).toBe(bssid);
      expect(res.body.observations).toEqual(mockObservations);
      expect(typeof res.body.observations[0].time).toBe('number');
      expect(res.body.home).toEqual(mockHome);
    });

    it('should return 400 for truly invalid BSSID', async () => {
      // Use characters that fail both MAC and alphanumeric validation
      const res = await request(app).get('/api/networks/observations/invalid!bssid');
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/networks/:bssid/wigle-observations', () => {
    it('should return WiGLE observations when table exists', async () => {
      const bssid = '00:11:22:33:44:55';
      const mockWigleObs = [
        {
          bssid,
          lat: 37.775,
          lon: -122.419,
          time: 1600000000000,
          level: -60,
          ssid: 'TestNet',
          is_matched: true,
          distance_from_our_center_m: 2.5,
        },
      ];

      mockContainer.observationService.checkWigleTableExists.mockResolvedValue(true);
      mockContainer.observationService.getWigleObservationsByBSSID.mockResolvedValue(mockWigleObs);
      mockContainer.observationService.getOurObservationCount.mockResolvedValue(5);

      const res = await request(app).get(`/api/networks/${bssid}/wigle-observations`);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.stats.wigle_total).toBe(1);
    });

    it('returns 400 for invalid BSSID on wigle-observations route', async () => {
      const res = await request(app).get('/api/networks/invalid!bssid/wigle-observations');
      expect(res.status).toBe(400);
    });

    it('returns empty observations with message when wigle table does not exist', async () => {
      mockContainer.observationService.checkWigleTableExists.mockResolvedValue(false);
      const res = await request(app).get('/api/networks/00:11:22:33:44:55/wigle-observations');
      expect(res.status).toBe(200);
      expect(res.body.observations).toEqual([]);
      expect(res.body.message).toContain('not available');
    });

    it('correctly maps is_matched to source field for unmatched observations', async () => {
      const bssid = '00:11:22:33:44:55';
      mockContainer.observationService.checkWigleTableExists.mockResolvedValue(true);
      mockContainer.observationService.getWigleObservationsByBSSID.mockResolvedValue([
        {
          bssid,
          lat: 37.0,
          lon: -122.0,
          time: 1600000000,
          level: -70,
          ssid: null,
          frequency: null,
          channel: null,
          encryption: null,
          altitude: null,
          accuracy: null,
          is_matched: false,
          distance_from_our_center_m: 120,
        },
      ]);
      mockContainer.observationService.getOurObservationCount.mockResolvedValue(0);

      const res = await request(app).get(`/api/networks/${bssid}/wigle-observations`);
      expect(res.body.observations[0].source).toBe('wigle_unique');
      expect(res.body.stats.max_distance_from_our_sightings_m).toBe(120);
    });
  });

  describe('POST /api/networks/wigle-observations/batch', () => {
    it('returns 400 when bssids is not an array', async () => {
      const res = await request(app)
        .post('/api/networks/wigle-observations/batch')
        .send({ bssids: 'not-an-array' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('bssids array is required');
    });

    it('returns 400 when bssids array is empty', async () => {
      const res = await request(app)
        .post('/api/networks/wigle-observations/batch')
        .send({ bssids: [] });
      expect(res.status).toBe(400);
    });

    it('returns 400 when all provided bssids are invalid', async () => {
      const res = await request(app)
        .post('/api/networks/wigle-observations/batch')
        .send({ bssids: ['invalid!', 'also-invalid!'] });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('No valid BSSIDs');
    });

    it('returns empty networks with message when wigle table does not exist', async () => {
      mockContainer.observationService.checkWigleTableExists.mockResolvedValue(false);
      const res = await request(app)
        .post('/api/networks/wigle-observations/batch')
        .send({ bssids: ['00:11:22:33:44:55'] });
      expect(res.status).toBe(200);
      expect(res.body.networks).toEqual([]);
      expect(res.body.message).toContain('not available');
    });

    it('aggregates matched and unique observations across networks', async () => {
      const bssid1 = '00:11:22:33:44:55';
      const bssid2 = 'AA:BB:CC:DD:EE:FF';
      mockContainer.observationService.checkWigleTableExists.mockResolvedValue(true);
      mockContainer.observationService.getWigleObservationsBatch.mockResolvedValue([
        {
          bssid: bssid1,
          lat: 37.0,
          lon: -122.0,
          time: 1600000000,
          level: -60,
          ssid: 'Net1',
          frequency: 2437,
          channel: 6,
          encryption: 'WPA2',
          altitude: null,
          accuracy: 5,
          is_matched: true,
          distance_from_our_center_m: 10,
        },
        {
          bssid: bssid1,
          lat: 37.1,
          lon: -122.1,
          time: 1600000001,
          level: -70,
          ssid: 'Net1',
          frequency: 2437,
          channel: 6,
          encryption: 'WPA2',
          altitude: null,
          accuracy: 8,
          is_matched: false,
          distance_from_our_center_m: 250,
        },
        {
          bssid: bssid2,
          lat: 38.0,
          lon: -121.0,
          time: 1600000002,
          level: -55,
          ssid: 'Net2',
          frequency: 5180,
          channel: 36,
          encryption: 'WPA3',
          altitude: null,
          accuracy: 3,
          is_matched: true,
          distance_from_our_center_m: 5,
        },
      ]);

      const res = await request(app)
        .post('/api/networks/wigle-observations/batch')
        .send({ bssids: [bssid1, bssid2] });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.stats.total_wigle).toBe(3);
      expect(res.body.stats.total_matched).toBe(2);
      expect(res.body.stats.total_unique).toBe(1);
      expect(res.body.stats.network_count).toBe(2);

      const net1 = res.body.networks.find((n: any) => n.bssid === bssid1.toUpperCase());
      expect(net1.stats.wigle_total).toBe(2);
      expect(net1.stats.matched).toBe(1);
      expect(net1.stats.unique).toBe(1);
      expect(net1.stats.max_distance_m).toBe(250);
    });

    it('includes networks with zero observations in the response', async () => {
      mockContainer.observationService.checkWigleTableExists.mockResolvedValue(true);
      // Only returns rows for one of two requested BSSIDs
      mockContainer.observationService.getWigleObservationsBatch.mockResolvedValue([
        {
          bssid: '00:11:22:33:44:55',
          lat: 37.0,
          lon: -122.0,
          time: 1600000000,
          level: -60,
          ssid: null,
          frequency: null,
          channel: null,
          encryption: null,
          altitude: null,
          accuracy: null,
          is_matched: false,
          distance_from_our_center_m: null,
        },
      ]);

      const res = await request(app)
        .post('/api/networks/wigle-observations/batch')
        .send({ bssids: ['00:11:22:33:44:55', 'FF:EE:DD:CC:BB:AA'] });

      expect(res.status).toBe(200);
      // Both networks should appear even though only one has data
      expect(res.body.networks.length).toBe(2);
      const empty = res.body.networks.find((n: any) => n.bssid === 'FF:EE:DD:CC:BB:AA');
      expect(empty.observations).toEqual([]);
      expect(empty.stats.wigle_total).toBe(0);
    });

    it('silently skips non-string entries in the bssids array', async () => {
      mockContainer.observationService.checkWigleTableExists.mockResolvedValue(true);
      mockContainer.observationService.getWigleObservationsBatch.mockResolvedValue([]);

      const res = await request(app)
        .post('/api/networks/wigle-observations/batch')
        .send({ bssids: [123, null, '00:11:22:33:44:55'] });

      expect(res.status).toBe(200);
      // Only the valid string BSSID should reach the service
      expect(mockContainer.observationService.getWigleObservationsBatch).toHaveBeenCalledWith([
        '00:11:22:33:44:55',
      ]);
    });
  });

  describe('POST /api/observations/correlate-visint', () => {
    it('accepts multipart VISINT image uploads', async () => {
      const image = Buffer.from('fake-visint-image');
      mockContainer.observationService.correlateVisINT.mockResolvedValue({
        status: 'UNMATCHED',
        observation_id: null,
        detection_score: 0,
        dist_meters: null,
        delta_minutes: null,
        tags_applied: [],
        exif: { lat: 1, lon: 2, ts: '2026-06-05T00:00:00.000Z' },
        candidates: [],
      });

      const res = await request(app)
        .post('/api/observations/correlate-visint')
        .attach('image', image, 'visint.jpg')
        .field('filename', 'visint.jpg')
        .field('commit', 'false')
        .field('radius_meters', '75')
        .field('window_hours', '3')
        .field('limit', '7');

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      const call = mockContainer.observationService.correlateVisINT.mock.calls[0];
      expect(Buffer.isBuffer(call[0])).toBe(true);
      expect(call[0].equals(image)).toBe(true);
      expect(call.slice(1)).toEqual(['visint.jpg', false, 75, 3, 7, false]);
    });

    it('defaults commit to false when commit field is omitted — does not write media', async () => {
      const image = Buffer.from('fake-visint-image');
      mockContainer.observationService.correlateVisINT.mockResolvedValue({
        status: 'UNMATCHED',
        observation_id: null,
        detection_score: 0,
        dist_meters: null,
        delta_minutes: null,
        tags_applied: [],
        exif: { lat: 1, lon: 2, ts: '2026-06-05T00:00:00.000Z' },
        candidates: [],
      });

      const res = await request(app)
        .post('/api/observations/correlate-visint')
        .attach('image', image, 'visint.jpg');

      expect(res.status).toBe(200);
      // commit arg passed to service must be false (the default)
      const call = mockContainer.observationService.correlateVisINT.mock.calls[0];
      expect(call[2]).toBe(false);
      // saveVisINTAttachment must never be called on a correlate request
      expect(mockContainer.observationService.saveVisINTAttachment).not.toHaveBeenCalled();
    });

    it('rejects commit=true on the unmatched fallback without confirm_fallback', async () => {
      const image = Buffer.from('fake-visint-image');
      mockContainer.observationService.correlateVisINT.mockRejectedValue({
        name: 'VISINTFallbackRequiresConfirmationError',
        message:
          'Correlating to the VISINT_UNMATCHED fallback BSSID requires explicit confirmation. Set confirm_fallback=true to proceed.',
      });

      const res = await request(app)
        .post('/api/observations/correlate-visint')
        .attach('image', image, 'visint.jpg')
        .field('commit', 'true');

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VISINT_FALLBACK_REQUIRES_CONFIRMATION');
    });

    it('passes commit=true to service when explicitly requested', async () => {
      const image = Buffer.from('fake-visint-image');
      mockContainer.observationService.correlateVisINT.mockResolvedValue({
        status: 'MATCHED',
        observation_id: '99',
        detection_score: 3,
        dist_meters: 5.0,
        delta_minutes: 0.5,
        tags_applied: ['FLOCK_LEGACY', 'VISINT_VERIFIED'],
        exif: { lat: 1, lon: 2, ts: '2026-06-05T00:00:00.000Z' },
        candidates: [],
      });

      const res = await request(app)
        .post('/api/observations/correlate-visint')
        .attach('image', image, 'visint.jpg')
        .field('commit', 'true');

      expect(res.status).toBe(200);
      const call = mockContainer.observationService.correlateVisINT.mock.calls[0];
      expect(call[2]).toBe(true);
    });

    it('returns 413 for VISINT images over the route-specific limit', async () => {
      const oversizedImage = Buffer.alloc(25 * 1024 * 1024 + 1);

      const res = await request(app)
        .post('/api/observations/correlate-visint')
        .attach('image', oversizedImage, 'too-large.jpg');

      expect(res.status).toBe(413);
      expect(res.body).toEqual(
        expect.objectContaining({
          ok: false,
          code: 'PAYLOAD_TOO_LARGE',
        })
      );
      expect(mockContainer.observationService.correlateVisINT).not.toHaveBeenCalled();
    });

    it('returns 400 for invalid VISINT file types (non-image)', async () => {
      const textFile = Buffer.from('some text data');

      const res = await request(app)
        .post('/api/observations/correlate-visint')
        .attach('image', textFile, 'not-an-image.txt');

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        ok: false,
        error: 'Invalid file type. Only JPEG and PNG are allowed.',
        code: 'INVALID_FILE_TYPE',
      });
      expect(mockContainer.observationService.correlateVisINT).not.toHaveBeenCalled();
    });

    it('returns 503 when the VISINT EXIF parser is unavailable', async () => {
      const image = Buffer.from('fake-visint-image');
      const error = new Error(
        'VISINT EXIF parser is unavailable. Install exiftool in the API runtime.'
      );
      error.name = 'ExifToolUnavailableError';
      mockContainer.observationService.correlateVisINT.mockRejectedValue(error);

      const res = await request(app)
        .post('/api/observations/correlate-visint')
        .attach('image', image, 'visint.jpg');

      expect(res.status).toBe(503);
      expect(res.body).toEqual({
        error: 'VISINT EXIF parser is unavailable. Install exiftool in the API runtime.',
        type: 'ExifToolUnavailableError',
        code: 'VISINT_EXIF_TOOL_UNAVAILABLE',
      });
    });

    it('rejects malformed radius/window/limit on correlate-visint', async () => {
      const image = Buffer.from('fake-visint-image');
      const res = await request(app)
        .post('/api/observations/correlate-visint')
        .attach('image', image, 'visint.jpg')
        .field('radius_meters', 'abc');

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VISINT_INVALID_NUMERIC_PARAMS');
      expect(mockContainer.observationService.correlateVisINT).not.toHaveBeenCalled();
    });

    it('returns 400 when no image file is attached to correlate-visint', async () => {
      const res = await request(app)
        .post('/api/observations/correlate-visint')
        .field('filename', 'visint.jpg');

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('image file field is required');
    });

    it('returns 500 for unexpected service errors on correlate-visint', async () => {
      const image = Buffer.from('fake-visint-image');
      mockContainer.observationService.correlateVisINT.mockRejectedValue(
        new Error('Unexpected DB failure')
      );

      const res = await request(app)
        .post('/api/observations/correlate-visint')
        .attach('image', image, 'visint.jpg');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('VisINT correlation failed');
      expect(res.body.details).toBe('Unexpected DB failure');
    });
  });

  describe('POST /api/observations/attach-visint', () => {
    it('accepts multipart VISINT attachment uploads', async () => {
      const image = Buffer.from('fake-visint-attachment');
      mockContainer.observationService.saveVisINTAttachment.mockResolvedValue(['VISINT_VERIFIED']);

      const res = await request(app)
        .post('/api/observations/attach-visint')
        .attach('image', image, 'visint.jpg')
        .field('filename', 'visint.jpg')
        .field('bssid', 'AA:BB:CC:DD:EE:FF')
        .field('status', 'MATCHED')
        .field('detection_score', '3')
        .field('dist_meters', '12.5')
        .field('delta_minutes', '4.25')
        .field('lat', '39.1')
        .field('lon', '-76.2')
        .field('ts', '2026-06-05T00:00:00.000Z')
        .field('manual_override', 'false');
      // Note: device_type not sent → null on server side

      expect(res.status).toBe(200);
      expect(res.body.tags_applied).toEqual(['VISINT_VERIFIED']);
      const call = mockContainer.observationService.saveVisINTAttachment.mock.calls[0];
      expect(Buffer.isBuffer(call[0])).toBe(true);
      expect(call[0].equals(image)).toBe(true);
      expect(call.slice(1)).toEqual([
        'visint.jpg',
        'AA:BB:CC:DD:EE:FF',
        'MATCHED',
        3,
        12.5,
        4.25,
        39.1,
        -76.2,
        '2026-06-05T00:00:00.000Z',
        false,
        null,
        null,
      ]);
    });

    it('accepts multipart VISINT attachment uploads with observation_id', async () => {
      const image = Buffer.from('fake-visint-attachment-with-obs');
      mockContainer.observationService.saveVisINTAttachment.mockResolvedValue(['VISINT_VERIFIED']);

      const res = await request(app)
        .post('/api/observations/attach-visint')
        .attach('image', image, 'visint.jpg')
        .field('filename', 'visint.jpg')
        .field('bssid', 'AA:BB:CC:DD:EE:FF')
        .field('status', 'MATCHED')
        .field('detection_score', '3')
        .field('dist_meters', '12.5')
        .field('delta_minutes', '4.25')
        .field('lat', '39.1')
        .field('lon', '-76.2')
        .field('ts', '2026-06-05T00:00:00.000Z')
        .field('manual_override', 'false')
        .field('observation_id', '987654');

      expect(res.status).toBe(200);
      expect(res.body.tags_applied).toEqual(['VISINT_VERIFIED']);
      const call = mockContainer.observationService.saveVisINTAttachment.mock.calls[0];
      expect(Buffer.isBuffer(call[0])).toBe(true);
      expect(call[0].equals(image)).toBe(true);
      expect(call.slice(1)).toEqual([
        'visint.jpg',
        'AA:BB:CC:DD:EE:FF',
        'MATCHED',
        3,
        12.5,
        4.25,
        39.1,
        -76.2,
        '2026-06-05T00:00:00.000Z',
        false,
        null,
        '987654',
      ]);
    });

    it('rejects VISINT_UNMATCHED target without confirm_fallback', async () => {
      const image = Buffer.from('fake-visint-attachment');

      const res = await request(app)
        .post('/api/observations/attach-visint')
        .attach('image', image, 'visint.jpg')
        .field('bssid', 'VISINT_UNMATCHED')
        .field('status', 'UNMATCHED');

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VISINT_FALLBACK_REQUIRES_CONFIRMATION');
      expect(mockContainer.observationService.saveVisINTAttachment).not.toHaveBeenCalled();
    });

    it('rejects VISINT_UNMATCHED target when confirm_fallback=false', async () => {
      const image = Buffer.from('fake-visint-attachment');

      const res = await request(app)
        .post('/api/observations/attach-visint')
        .attach('image', image, 'visint.jpg')
        .field('bssid', 'VISINT_UNMATCHED')
        .field('confirm_fallback', 'false');

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VISINT_FALLBACK_REQUIRES_CONFIRMATION');
      expect(mockContainer.observationService.saveVisINTAttachment).not.toHaveBeenCalled();
    });

    it('allows VISINT_UNMATCHED target when confirm_fallback=true', async () => {
      const image = Buffer.from('fake-visint-attachment');
      mockContainer.observationService.saveVisINTAttachment.mockResolvedValue([
        'UNMATCHED_NODE',
        'VISINT_UNMATCHED',
      ]);

      const res = await request(app)
        .post('/api/observations/attach-visint')
        .attach('image', image, 'visint.jpg')
        .field('bssid', 'VISINT_UNMATCHED')
        .field('status', 'UNMATCHED')
        .field('confirm_fallback', 'true');

      expect(res.status).toBe(200);
      expect(res.body.tags_applied).toEqual(['UNMATCHED_NODE', 'VISINT_UNMATCHED']);
      expect(mockContainer.observationService.saveVisINTAttachment).toHaveBeenCalled();
    });

    it('rejects malformed detection_score instead of passing NaN into saveVisINTAttachment', async () => {
      const image = Buffer.from('fake-visint-attachment');
      const res = await request(app)
        .post('/api/observations/attach-visint')
        .attach('image', image, 'visint.jpg')
        .field('bssid', 'AA:BB:CC:DD:EE:FF')
        .field('detection_score', 'invalid-score');

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VISINT_INVALID_DETECTION_SCORE');
      expect(mockContainer.observationService.saveVisINTAttachment).not.toHaveBeenCalled();
    });

    it('rejects malformed lat/lon on attach-visint instead of passing NaN', async () => {
      const image = Buffer.from('fake-visint-attachment');
      const res = await request(app)
        .post('/api/observations/attach-visint')
        .attach('image', image, 'visint.jpg')
        .field('bssid', 'AA:BB:CC:DD:EE:FF')
        .field('lat', 'invalid-lat');

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VISINT_INVALID_NUMERIC_PARAMS');
      expect(mockContainer.observationService.saveVisINTAttachment).not.toHaveBeenCalled();
    });

    it('returns 400 when no image file is attached to attach-visint', async () => {
      const res = await request(app)
        .post('/api/observations/attach-visint')
        .field('bssid', 'AA:BB:CC:DD:EE:FF')
        .field('status', 'MATCHED');

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('image file field is required');
    });

    it('returns 500 for unexpected service errors on attach-visint', async () => {
      const image = Buffer.from('fake-visint-attachment');
      mockContainer.observationService.saveVisINTAttachment.mockRejectedValue(
        new Error('Storage failure')
      );

      const res = await request(app)
        .post('/api/observations/attach-visint')
        .attach('image', image, 'visint.jpg')
        .field('bssid', 'AA:BB:CC:DD:EE:FF')
        .field('status', 'MATCHED');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('VisINT attachment failed');
      expect(res.body.details).toBe('Storage failure');
    });
  });
});
