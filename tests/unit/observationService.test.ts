export {};

import {
  getHomeLocationForObservations,
  getObservationsByBSSID,
  checkWigleTableExists,
  getWigleObservationsByBSSID,
  getOurObservationCount,
  getWigleObservationsBatch,
  correlateImageBLE,
  correlateVisINT,
  saveVisINTAttachment,
  ExifToolUnavailableError,
} from '../../server/src/services/observationService';

const { query } = require('../../server/src/config/database');
const { execFile } = require('child_process');

jest.mock('../../server/src/config/database', () => ({
  query: jest.fn(),
}));

jest.mock('child_process', () => ({
  exec: jest.fn(),
  execFile: jest.fn(),
}));

jest.mock('../../server/src/repositories/adminNetworkMediaRepository', () => ({
  insertNetworkMedia: jest.fn(),
}));

jest.mock('../../server/src/repositories/adminNetworkTagOuiRepository', () => ({
  addTagToNetwork: jest.fn(),
  getNetworkTagsByBssid: jest.fn(),
  insertNetworkTagWithNotes: jest.fn(),
}));

describe('Observation Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getHomeLocationForObservations', () => {
    it('should return lon/lat if home location exists', async () => {
      (query as jest.Mock).mockResolvedValueOnce({
        rows: [{ lon: -122.4194, lat: 37.7749 }],
      });

      const result = await getHomeLocationForObservations();
      expect(result).toEqual({ lon: -122.4194, lat: 37.7749 });
      expect(query).toHaveBeenCalledWith(expect.stringContaining("marker_type = 'home'"));
    });

    it('should return null if home location does not exist', async () => {
      (query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const result = await getHomeLocationForObservations();
      expect(result).toBeNull();
    });

    it('should return null on DB error', async () => {
      (query as jest.Mock).mockRejectedValueOnce(new Error('DB Error'));

      const result = await getHomeLocationForObservations();
      expect(result).toBeNull();
    });
  });

  describe('getObservationsByBSSID', () => {
    it('should return observations with distance from home when home coordinates provided', async () => {
      const mockRows = [
        {
          id: 1,
          bssid: 'AA:BB:CC:DD:EE:FF',
          ssid: 'Test',
          lat: 37.7,
          lon: -122.4,
          distance_from_home_km: 0.1,
        },
      ];
      (query as jest.Mock).mockResolvedValueOnce({ rows: mockRows });

      const result = await getObservationsByBSSID('AA:BB:CC:DD:EE:FF', -122.4194, 37.7749);
      expect(result).toEqual(mockRows);
      const sql = (query as jest.Mock).mock.calls[0][0];
      expect(sql).toContain('(EXTRACT(EPOCH FROM o.time) * 1000)::float8 as time');
      expect(query).toHaveBeenCalledWith(expect.stringContaining('ST_Distance'), [
        -122.4194,
        37.7749,
        'AA:BB:CC:DD:EE:FF',
      ]);
    });

    it('should return observations without distance when home coordinates are null', async () => {
      const mockRows = [
        {
          id: 1,
          bssid: 'AA:BB:CC:DD:EE:FF',
          ssid: 'Test',
          lat: 37.7,
          lon: -122.4,
          distance_from_home_km: null,
        },
      ];
      (query as jest.Mock).mockResolvedValueOnce({ rows: mockRows });

      const result = await getObservationsByBSSID('AA:BB:CC:DD:EE:FF', null, null);
      expect(result).toEqual(mockRows);
      expect(query).toHaveBeenCalledWith(expect.anything(), [null, null, 'AA:BB:CC:DD:EE:FF']);
    });
  });

  describe('checkWigleTableExists', () => {
    it('should return true if table exists', async () => {
      (query as jest.Mock).mockResolvedValueOnce({
        rows: [{ exists: true }],
      });

      const result = await checkWigleTableExists();
      expect(result).toBe(true);
      expect(query).toHaveBeenCalledWith(expect.stringContaining('wigle_v3_observations'));
    });

    it('should return false if table does not exist', async () => {
      (query as jest.Mock).mockResolvedValueOnce({
        rows: [{ exists: false }],
      });

      const result = await checkWigleTableExists();
      expect(result).toBe(false);
    });
  });

  describe('getWigleObservationsByBSSID', () => {
    it('should return enriched WiGLE observations', async () => {
      const mockRows = [
        {
          bssid: 'AA:BB',
          lat: 37.7,
          lon: -122.4,
          is_matched: true,
          distance_from_our_center_m: 2.5,
        },
      ];
      (query as jest.Mock).mockResolvedValueOnce({ rows: mockRows });

      const result = await getWigleObservationsByBSSID('AA:BB');
      expect(result).toEqual(mockRows);
      expect(query).toHaveBeenCalledWith(expect.stringContaining('app.wigle_v3_observations'), [
        'AA:BB',
      ]);
    });
  });

  describe('getOurObservationCount', () => {
    it('should return count as number', async () => {
      (query as jest.Mock).mockResolvedValueOnce({
        rows: [{ count: '42' }],
      });

      const result = await getOurObservationCount('AA:BB');
      expect(result).toBe(42);
      expect(query).toHaveBeenCalledWith(expect.stringContaining('COUNT(*)'), ['AA:BB']);
    });

    it('should return 0 if no results', async () => {
      (query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const result = await getOurObservationCount('AA:BB');
      expect(result).toBe(0);
    });
  });

  describe('getWigleObservationsBatch', () => {
    it('should return batch of enriched WiGLE observations', async () => {
      const mockRows = [
        { bssid: 'AA:BB', lat: 37.7, lon: -122.4, is_matched: true },
        { bssid: 'CC:DD', lat: 37.8, lon: -122.5, is_matched: false },
      ];
      (query as jest.Mock).mockResolvedValueOnce({ rows: mockRows });

      const result = await getWigleObservationsBatch(['AA:BB', 'CC:DD']);
      expect(result).toEqual(mockRows);
      expect(query).toHaveBeenCalledWith(expect.stringContaining('ANY($1)'), [['AA:BB', 'CC:DD']]);
    });
  });

  describe('correlateImageBLE', () => {
    it('should extract EXIF telemetry and execute spatial correlation query', async () => {
      (execFile as unknown as jest.Mock).mockImplementation((file, args, callback) => {
        const cmdStr = args.join(' ');
        if (cmdStr.includes('$GPSLatitude')) {
          callback(null, { stdout: '43.023\n' });
        } else if (cmdStr.includes('$GPSLongitude')) {
          callback(null, { stdout: '-83.696\n' });
        } else if (cmdStr.includes('$DateTimeOriginal')) {
          callback(null, { stdout: '2026-05-06 20:29:10\n' });
        } else {
          callback(new Error('Unknown command'));
        }
      });

      const mockRows = [
        {
          bssid: '23:D4:25:1B:46:00',
          signal: -65,
          dist_meters: 6.77,
          delta_minutes: 31134.2,
        },
      ];
      (query as jest.Mock).mockResolvedValueOnce({ rows: mockRows });

      const result = await correlateImageBLE('dummy.jpg');

      expect(result).toEqual({
        image: 'dummy.jpg',
        lat: 43.023,
        lon: -83.696,
        timestamp: '2026-05-06 20:29:10',
        matches: [
          {
            bssid: '23:D4:25:1B:46:00',
            signal: -65,
            dist_meters: 6.77,
            delta_minutes: 31134.2,
          },
        ],
      });

      expect(query).toHaveBeenCalledWith(expect.stringContaining("radio_type = 'E'"), [
        -83.696,
        43.023,
        '2026-05-06 20:29:10',
        150,
        30,
        1,
      ]);
    });

    it('should throw an error if EXIF parsing fails', async () => {
      (execFile as unknown as jest.Mock).mockImplementation((file, args, callback) => {
        callback(new Error('exiftool error'));
      });

      await expect(correlateImageBLE('dummy.jpg')).rejects.toThrow(
        'Failed to parse EXIF payload for dummy.jpg'
      );
    });

    it('should throw ExifToolUnavailableError if exiftool is missing from runtime', async () => {
      (execFile as unknown as jest.Mock).mockImplementation((file, args, callback) => {
        callback(Object.assign(new Error('spawn exiftool ENOENT'), { code: 'ENOENT' }));
      });

      await expect(correlateImageBLE('dummy.jpg')).rejects.toBeInstanceOf(ExifToolUnavailableError);
    });
  });

  describe('correlateVisINT', () => {
    const {
      insertNetworkMedia,
    } = require('../../server/src/repositories/adminNetworkMediaRepository');
    const {
      addTagToNetwork,
      getNetworkTagsByBssid,
      insertNetworkTagWithNotes,
    } = require('../../server/src/repositories/adminNetworkTagOuiRepository');

    beforeEach(() => {
      jest.clearAllMocks();
      // Setup successful EXIF tool mock
      (execFile as unknown as jest.Mock).mockImplementation((file, args, callback) => {
        const cmdStr = args.join(' ');
        if (cmdStr.includes('$GPSLatitude')) {
          callback(null, { stdout: '43.023\n' });
        } else if (cmdStr.includes('$GPSLongitude')) {
          callback(null, { stdout: '-83.696\n' });
        } else if (cmdStr.includes('$DateTimeOriginal')) {
          callback(null, { stdout: '2026-05-06 20:29:10\n' });
        } else if (cmdStr.includes('$OffsetTimeOriginal')) {
          callback(null, { stdout: '' });
        } else {
          callback(new Error('Unknown command'));
        }
      });
    });

    it('persists generated thumbnail and supplied EXIF metadata', async () => {
      const sharp = require('sharp');
      const png = await sharp({
        create: {
          width: 2,
          height: 2,
          channels: 3,
          background: { r: 255, g: 0, b: 0 },
        },
      })
        .png()
        .toBuffer();
      (getNetworkTagsByBssid as jest.Mock).mockResolvedValueOnce(null);

      await saveVisINTAttachment(
        png,
        'evidence.png',
        'AA:BB:CC:DD:EE:FF',
        'MATCHED',
        2,
        4.5,
        1.2,
        43.023,
        -83.696,
        '2026-05-06 20:29:10'
      );

      expect(insertNetworkMedia).toHaveBeenCalledWith(
        'AA:BB:CC:DD:EE:FF',
        'image',
        'evidence.png',
        png.length,
        'image/png',
        png,
        expect.stringContaining('score=2'),
        43.023,
        -83.696,
        '2026-05-06 20:29:10',
        expect.any(Buffer),
        null
      );
    });

    it('should successfully MATCH correlation with score 4 (new firmware / BLE UUID)', async () => {
      const mockRow = {
        id: 12345,
        bssid: 'aa:bb:cc:dd:ee:ff',
        ssid: '4',
        radio_type: 'E',
        level: -70,
        observed_at: '2026-05-06 20:29:10',
        lat: 43.023,
        lon: -83.696,
        dist_meters: 5.4,
        delta_minutes: 0.1,
        detection_score: '4',
        device_type: 'FLOCK_SAFETY_CAMERA',
      };
      (query as jest.Mock).mockResolvedValueOnce({ rows: [mockRow] });
      (getNetworkTagsByBssid as jest.Mock).mockResolvedValueOnce(null);

      const result = await correlateVisINT(Buffer.from('dummy'), 'test.jpg', true);

      expect(result).toEqual({
        status: 'MATCHED',
        observation_id: '12345',
        detection_score: 4,
        dist_meters: 5.4,
        delta_minutes: 0.1,
        tags_applied: ['FLOCK_NEW_FIRMWARE', 'VISINT_VERIFIED'],
        exif: { lat: 43.023, lon: -83.696, ts: '2026-05-06 20:29:10' },
        candidates: [mockRow],
      });

      expect(insertNetworkMedia).toHaveBeenCalledWith(
        'AA:BB:CC:DD:EE:FF',
        'image',
        'test.jpg',
        5,
        'image/jpeg',
        expect.any(Buffer),
        expect.stringContaining('score=4'),
        43.023,
        -83.696,
        '2026-05-06 20:29:10',
        null,
        '12345'
      );

      expect(insertNetworkTagWithNotes).toHaveBeenCalledWith(
        'AA:BB:CC:DD:EE:FF',
        ['FLOCK_NEW_FIRMWARE', 'VISINT_VERIFIED'],
        null
      );
    });

    it('should successfully MATCH correlation with score 3 (legacy firmware / Penguin SSID)', async () => {
      const mockRow = {
        id: 12345,
        bssid: 'aa:bb:cc:dd:ee:ff',
        ssid: 'Penguin-1234567890',
        radio_type: 'E',
        level: -70,
        observed_at: '2026-05-06 20:29:10',
        lat: 43.023,
        lon: -83.696,
        dist_meters: 5.4,
        delta_minutes: 0.1,
        detection_score: '3',
        device_type: 'FLOCK_SAFETY_CAMERA',
      };
      (query as jest.Mock).mockResolvedValueOnce({ rows: [mockRow] });
      (getNetworkTagsByBssid as jest.Mock).mockResolvedValueOnce({ tags: ['SOME_TAG'] });

      const result = await correlateVisINT(Buffer.from('dummy'), 'test.jpg', true);

      expect(result.tags_applied).toEqual(['FLOCK_LEGACY', 'VISINT_VERIFIED']);
      expect(addTagToNetwork).toHaveBeenCalledTimes(2);
      expect(addTagToNetwork).toHaveBeenNthCalledWith(1, 'AA:BB:CC:DD:EE:FF', 'FLOCK_LEGACY', null);
      expect(addTagToNetwork).toHaveBeenNthCalledWith(
        2,
        'AA:BB:CC:DD:EE:FF',
        'VISINT_VERIFIED',
        null
      );
    });

    it('should successfully MATCH correlation with score 1 (candidate)', async () => {
      const mockRow = {
        id: 12345,
        bssid: 'aa:bb:cc:dd:ee:ff',
        ssid: '4',
        radio_type: 'E',
        level: -70,
        observed_at: '2026-05-06 20:29:10',
        lat: 43.023,
        lon: -83.696,
        dist_meters: 5.4,
        delta_minutes: 0.1,
        detection_score: '1',
        device_type: 'FLOCK_SAFETY_CAMERA',
      };
      (query as jest.Mock).mockResolvedValueOnce({ rows: [mockRow] });
      (getNetworkTagsByBssid as jest.Mock).mockResolvedValueOnce(null);

      const result = await correlateVisINT(Buffer.from('dummy'), 'test.jpg', true);

      expect(result.tags_applied).toEqual(['FLOCK_CANDIDATE', 'VISINT_PENDING']);
    });

    it('should fallback to UNMATCHED when query returns no rows and confirm_fallback=true', async () => {
      (query as jest.Mock).mockResolvedValueOnce({ rows: [] });
      (getNetworkTagsByBssid as jest.Mock).mockResolvedValueOnce(null);

      const result = await correlateVisINT(Buffer.from('dummy'), 'test.jpg', true, 50, 2, 5, true);

      expect(result).toEqual({
        status: 'UNMATCHED',
        observation_id: null,
        detection_score: 0,
        dist_meters: null,
        delta_minutes: null,
        tags_applied: ['UNMATCHED_NODE', 'VISINT_UNMATCHED'],
        exif: { lat: 43.023, lon: -83.696, ts: '2026-05-06 20:29:10' },
        candidates: [],
      });

      expect(insertNetworkMedia).toHaveBeenCalledWith(
        'VISINT_UNMATCHED',
        'image',
        'test.jpg',
        5,
        'image/jpeg',
        expect.any(Buffer),
        expect.stringContaining('extracted_lat'),
        43.023,
        -83.696,
        '2026-05-06 20:29:10',
        null,
        null
      );

      expect(insertNetworkTagWithNotes).toHaveBeenCalledWith(
        'VISINT_UNMATCHED',
        ['UNMATCHED_NODE', 'VISINT_UNMATCHED'],
        null
      );
    });

    it('should apply SHOTSPOTTER_SENSOR tag when SSID matches ShotSpotter prefix', async () => {
      const mockRow = {
        id: 99,
        bssid: 'bb:cc:dd:ee:ff:00',
        ssid: 'ShotSpotter-Unit7',
        radio_type: 'W',
        level: -65,
        observed_at: '2026-05-06 20:29:10',
        lat: 43.023,
        lon: -83.696,
        dist_meters: 12.0,
        delta_minutes: 0.5,
        detection_score: '2',
        device_type: 'SHOTSPOTTER_SENSOR',
      };
      (query as jest.Mock).mockResolvedValueOnce({ rows: [mockRow] });
      (getNetworkTagsByBssid as jest.Mock).mockResolvedValueOnce(null);

      const result = await correlateVisINT(Buffer.from('dummy'), 'shotspotter_capture.jpg', true);

      expect(result.tags_applied).toContain('SHOTSPOTTER_SENSOR');
    });

    it('should throw ExifMissingError if EXIF fields are missing', async () => {
      // Mock empty output for longitude
      (execFile as unknown as jest.Mock).mockImplementation((file, args, callback) => {
        const cmdStr = args.join(' ');
        if (cmdStr.includes('$GPSLatitude')) {
          callback(null, { stdout: '43.023\n' });
        } else if (cmdStr.includes('$GPSLongitude')) {
          callback(null, { stdout: '' });
        } else if (cmdStr.includes('$DateTimeOriginal')) {
          callback(null, { stdout: '' });
        } else if (cmdStr.includes('$OffsetTimeOriginal')) {
          callback(null, { stdout: '' });
        } else {
          callback(new Error('Unknown command'));
        }
      });

      await expect(correlateVisINT(Buffer.from('dummy'), 'test.jpg')).rejects.toThrow(
        /Missing EXIF telemetry fields: GPSLongitude, DateTimeOriginal/
      );
    });

    it('defaults correlateVisINT to preview mode and does not persist media/tags when commit is omitted', async () => {
      const mockRow = {
        id: 12345,
        bssid: 'aa:bb:cc:dd:ee:ff',
        ssid: '4',
        radio_type: 'E',
        level: -70,
        observed_at: '2026-05-06 20:29:10',
        lat: 43.023,
        lon: -83.696,
        dist_meters: 5.4,
        delta_minutes: 0.1,
        detection_score: '4',
        device_type: 'FLOCK_SAFETY_CAMERA',
      };
      (query as jest.Mock).mockResolvedValueOnce({ rows: [mockRow] });
      (getNetworkTagsByBssid as jest.Mock).mockResolvedValueOnce(null);

      const result = await correlateVisINT(Buffer.from('dummy'), 'test.jpg');

      expect(result.status).toBe('MATCHED');
      expect(result.tags_applied).toEqual(['FLOCK_NEW_FIRMWARE', 'VISINT_VERIFIED']);

      expect(insertNetworkMedia).not.toHaveBeenCalled();
      expect(insertNetworkTagWithNotes).not.toHaveBeenCalled();
      expect(addTagToNetwork).not.toHaveBeenCalled();
    });

    it('rejects writing to VISINT_UNMATCHED during commit without explicit confirm_fallback', async () => {
      (execFile as unknown as jest.Mock).mockImplementation((file, args, callback) => {
        const cmdStr = args.join(' ');
        if (cmdStr.includes('$GPSLatitude')) {
          callback(null, { stdout: '43.023\n' });
        } else if (cmdStr.includes('$GPSLongitude')) {
          callback(null, { stdout: '-83.696\n' });
        } else if (cmdStr.includes('$DateTimeOriginal')) {
          callback(null, { stdout: '2026-05-06 20:29:10\n' });
        } else {
          callback(new Error('Unknown command'));
        }
      });
      (query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      await expect(
        correlateVisINT(Buffer.from('dummy'), 'test.jpg', true, 50, 2, 5, false)
      ).rejects.toThrow(
        'Correlating to the VISINT_UNMATCHED fallback BSSID requires explicit confirmation. Set confirm_fallback=true to proceed.'
      );
      expect(insertNetworkMedia).not.toHaveBeenCalled();
    });

    it('persists media/tags only when correlateVisINT commit=true is explicit', async () => {
      const mockRow = {
        id: 12345,
        bssid: 'aa:bb:cc:dd:ee:ff',
        ssid: '4',
        radio_type: 'E',
        level: -70,
        observed_at: '2026-05-06 20:29:10',
        lat: 43.023,
        lon: -83.696,
        dist_meters: 5.4,
        delta_minutes: 0.1,
        detection_score: '4',
        device_type: 'FLOCK_SAFETY_CAMERA',
      };
      (query as jest.Mock).mockResolvedValueOnce({ rows: [mockRow] });
      (getNetworkTagsByBssid as jest.Mock).mockResolvedValueOnce(null);

      const result = await correlateVisINT(Buffer.from('dummy'), 'test.jpg', true);

      expect(result.status).toBe('MATCHED');
      expect(insertNetworkMedia).toHaveBeenCalled();
      expect(insertNetworkTagWithNotes).toHaveBeenCalled();
    });
  });
});
