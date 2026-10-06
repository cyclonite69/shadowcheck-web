import path from 'path';
import fs from 'fs';
import {
  pickTag,
  sanitizeJsonValue,
  extractTypedExifFromTags,
  truncateOversizedPayload,
  extractMetadataDumpFromFile,
  extractMetadataDumpFromBuffer,
  MetadataDumpPayload,
  MAX_EXIF_RAW_BYTES,
} from '../../server/src/services/visint/visintMetadataDump';
import { extractExif, ExifMissingError } from '../../server/src/services/visint/visintExif';
import { insertNetworkMedia } from '../../server/src/repositories/adminNetworkMediaRepository';
import {
  fetchConnectionMetadata,
  validatePreflight,
  parseConfirmDbArg,
  main,
} from '../../scripts/backfill-network-media-exif-raw';

// Mock dependencies for repository test
const { adminQuery } = require('../../server/src/services/adminDbService');
const { query } = require('../../server/src/config/database');

jest.mock('../../server/src/services/adminDbService', () => ({
  adminQuery: jest.fn(),
}));

jest.mock('../../server/src/config/database', () => ({
  query: jest.fn(),
}));

describe('VisINT EXIF Raw & Migration 058 Metadata', () => {
  describe('Sanitization (NUL and Non-finite numbers)', () => {
    it('strips \\u0000 NUL characters from strings, object keys, and nested structures', () => {
      const input = {
        'IFD0:M\u0000ake': 'Sony\u0000Alpha',
        'ExifIFD:UserComment': 'Test\u0000 comment with embedded \u0000nulls',
        nested: {
          array: ['Hello\u0000World', 'Clean'],
        },
      };

      const result = sanitizeJsonValue(input);
      expect(result).toEqual({
        'IFD0:Make': 'SonyAlpha',
        'ExifIFD:UserComment': 'Test comment with embedded nulls',
        nested: {
          array: ['HelloWorld', 'Clean'],
        },
      });
      expect(JSON.stringify(result)).not.toContain('\u0000');
    });

    it('replaces NaN, Infinity, and -Infinity numbers with null', () => {
      const input = {
        validNumber: 42.5,
        notANumber: NaN,
        posInfinity: Infinity,
        negInfinity: -Infinity,
        nestedList: [1, NaN, 3, Infinity],
      };

      const result = sanitizeJsonValue(input);
      expect(result).toEqual({
        validNumber: 42.5,
        notANumber: null,
        posInfinity: null,
        negInfinity: null,
        nestedList: [1, null, 3, null],
      });
    });
  });

  describe('Tag Picker (pickTag) with -G1 groups', () => {
    const jpegG1Tags = {
      'IFD0:Make': 'Samsung',
      'IFD0:Model': 'SM-S908U',
      'ExifIFD:ExifImageWidth': 4000,
      'ExifIFD:ExifImageHeight': 3000,
      'GPS:GPSAltitude': 152.3,
      'GPS:GPSAltitudeRef': 0,
      'GPS:GPSImgDirection': 245.8,
    };

    const mp4G1Tags = {
      'Keys:Make': 'Apple',
      'Keys:Model': 'iPhone 15 Pro',
      'Track1:ImageWidth': 1920,
      'Track1:ImageHeight': 1080,
      'Composite:GPSAltitude': 45.0,
      'GPS:GPSAltitudeRef': 1,
    };

    const pngG1Tags = {
      'PNG:ImageWidth': 800,
      'PNG:ImageHeight': 600,
      'File:FileType': 'PNG',
    };

    it('picks tags across preferred groups in order for JPEG', () => {
      expect(pickTag(jpegG1Tags, 'Make', ['IFD0', 'Keys', 'File'])).toBe('Samsung');
      expect(pickTag(jpegG1Tags, 'Model', ['IFD0', 'Keys', 'File'])).toBe('SM-S908U');
      expect(pickTag(jpegG1Tags, 'GPSAltitude', ['Composite', 'GPS'])).toBe(152.3);
      expect(pickTag(jpegG1Tags, 'GPSAltitudeRef', ['GPS', 'Composite'])).toBe(0);
      expect(pickTag(jpegG1Tags, 'GPSImgDirection', ['Composite', 'GPS'])).toBe(245.8);
      expect(pickTag(jpegG1Tags, 'ExifImageWidth', ['ExifIFD', 'File'])).toBe(4000);
    });

    it('picks Keys:Make and Track1 dimensions for MP4', () => {
      expect(pickTag(mp4G1Tags, 'Make', ['IFD0', 'Keys', 'QuickTime'])).toBe('Apple');
      expect(pickTag(mp4G1Tags, 'Model', ['IFD0', 'Keys', 'QuickTime'])).toBe('iPhone 15 Pro');
      expect(pickTag(mp4G1Tags, 'ImageWidth', ['File', 'Track1', 'Composite'])).toBe(1920);
      expect(pickTag(mp4G1Tags, 'ImageHeight', ['File', 'Track1', 'Composite'])).toBe(1080);
      expect(pickTag(mp4G1Tags, 'GPSAltitude', ['Composite', 'GPS'])).toBe(45.0);
      expect(pickTag(mp4G1Tags, 'GPSAltitudeRef', ['GPS', 'Composite'])).toBe(1);
    });

    it('picks PNG-specific tags for PNG', () => {
      expect(pickTag(pngG1Tags, 'ImageWidth', ['PNG', 'File'])).toBe(800);
      expect(pickTag(pngG1Tags, 'ImageHeight', ['PNG', 'File'])).toBe(600);
      expect(pickTag(pngG1Tags, 'Make', ['IFD0', 'Keys'])).toBeNull();
    });
  });

  describe('Typed Column Extraction (extractTypedExifFromTags)', () => {
    it('correctly maps make, model, dimensions, and positive altitude', () => {
      const tags = {
        'IFD0:Make': '  Sony  ',
        'IFD0:Model': '  ILCE-7M4  ',
        'GPS:GPSAltitude': 120.4567,
        'GPS:GPSAltitudeRef': 0,
        'GPS:GPSImgDirection': 180.1234,
        'File:ImageWidth': 7008,
        'File:ImageHeight': 4672,
      };

      const result = extractTypedExifFromTags(tags);
      expect(result.exifMake).toBe('Sony');
      expect(result.exifModel).toBe('ILCE-7M4');
      expect(result.exifAltitude).toBe(120.457);
      expect(result.exifBearing).toBe(180.123);
      expect(result.exifWidth).toBe(7008);
      expect(result.exifHeight).toBe(4672);
    });

    it('honors GPSAltitudeRef=1 to produce negative altitude', () => {
      const tags = {
        'GPS:GPSAltitude': 28.5,
        'GPS:GPSAltitudeRef': 1, // Below sea level
      };

      const result = extractTypedExifFromTags(tags);
      expect(result.exifAltitude).toBe(-28.5);
    });

    it('honors GPSAltitudeRef="Below Sea Level" to produce negative altitude', () => {
      const tags = {
        'Composite:GPSAltitude': 14.2,
        'GPS:GPSAltitudeRef': 'Below Sea Level',
      };

      const result = extractTypedExifFromTags(tags);
      expect(result.exifAltitude).toBe(-14.2);
    });

    it('truncates Make and Model to 100 characters', () => {
      const longMake = 'A'.repeat(150);
      const longModel = 'B'.repeat(120);
      const tags = {
        'IFD0:Make': longMake,
        'IFD0:Model': longModel,
      };

      const result = extractTypedExifFromTags(tags);
      expect(result.exifMake?.length).toBe(100);
      expect(result.exifModel?.length).toBe(100);
      expect(result.exifMake).toBe('A'.repeat(100));
    });

    it('range-guards typed fields and sets out-of-range or NaN values to null while keeping normal values intact', () => {
      // Out-of-range values: 4294967295 width, 1e12 altitude, 720 bearing
      const invalidTags = {
        'File:ImageWidth': 4294967295, // > 100000
        'File:ImageHeight': 0, // < 1
        'GPS:GPSAltitude': 1e12, // > 100000
        'GPS:GPSImgDirection': 720, // > 360
      };
      const invalidResult = extractTypedExifFromTags(invalidTags);
      expect(invalidResult.exifWidth).toBeNull();
      expect(invalidResult.exifHeight).toBeNull();
      expect(invalidResult.exifAltitude).toBeNull();
      expect(invalidResult.exifBearing).toBeNull();

      // Below lower bounds: -25000 altitude, -10 bearing
      const lowerBoundTags = {
        'Composite:GPSAltitude': -25000, // < -20000
        'Composite:GPSImgDirection': -10, // < 0
      };
      const lowerBoundResult = extractTypedExifFromTags(lowerBoundTags);
      expect(lowerBoundResult.exifAltitude).toBeNull();
      expect(lowerBoundResult.exifBearing).toBeNull();

      // NaN values
      const nanTags = {
        'File:ImageWidth': 'NaN',
        'File:ImageHeight': 'invalid-dimension',
        'GPS:GPSAltitude': NaN,
        'GPS:GPSImgDirection': 'not-a-number',
      };
      const nanResult = extractTypedExifFromTags(nanTags);
      expect(nanResult.exifWidth).toBeNull();
      expect(nanResult.exifHeight).toBeNull();
      expect(nanResult.exifAltitude).toBeNull();
      expect(nanResult.exifBearing).toBeNull();

      // Normal values within valid range remain unchanged
      const validTags = {
        'File:ImageWidth': 1920,
        'File:ImageHeight': 1080,
        'GPS:GPSAltitude': 1250.5,
        'GPS:GPSImgDirection': 270.5,
      };
      const validResult = extractTypedExifFromTags(validTags);
      expect(validResult.exifWidth).toBe(1920);
      expect(validResult.exifHeight).toBe(1080);
      expect(validResult.exifAltitude).toBe(1250.5);
      expect(validResult.exifBearing).toBe(270.5);
    });

    it('returns null for missing attributes', () => {
      const result = extractTypedExifFromTags({});
      expect(result).toEqual({
        exifMake: null,
        exifModel: null,
        exifAltitude: null,
        exifBearing: null,
        exifWidth: null,
        exifHeight: null,
      });
    });
  });

  describe('Truncation (>512 KB)', () => {
    it('leaves payloads <= 512 KB untouched', () => {
      const payload: MetadataDumpPayload = {
        exiftool_version: '13.25',
        extracted_at: '2026-10-05T20:00:00.000Z',
        tags: {
          'IFD0:Make': 'Nikon',
          'IFD0:Model': 'Z9',
        },
      };

      const result = truncateOversizedPayload(payload);
      expect(result.truncated).toBeUndefined();
      expect(result.tags['IFD0:Make']).toBe('Nikon');
    });

    it('replaces only the largest values when exceeding 512 KB', () => {
      const hugeData1 = 'X'.repeat(400 * 1024);
      const hugeData2 = 'Y'.repeat(200 * 1024);
      const smallData = 'Z'.repeat(100);

      const payload: MetadataDumpPayload = {
        exiftool_version: '13.25',
        extracted_at: '2026-10-05T20:00:00.000Z',
        tags: {
          'Large:Tag1': hugeData1,
          'Large:Tag2': hugeData2,
          'Small:Tag3': smallData,
        },
      };

      const totalSizeBefore = Buffer.byteLength(JSON.stringify(payload), 'utf8');
      expect(totalSizeBefore).toBeGreaterThan(MAX_EXIF_RAW_BYTES);

      const result = truncateOversizedPayload(payload);
      expect(result.truncated).toBe(true);
      expect(result.original_size).toBe(totalSizeBefore);

      // Largest item was truncated
      expect(result.tags['Large:Tag1']).toEqual({
        truncated_value: true,
        original_size: expect.any(Number),
      });

      // Small item remains intact
      expect(result.tags['Small:Tag3']).toBe(smallData);

      // Now it fits within 512 KB
      const finalBytes = Buffer.byteLength(JSON.stringify(result), 'utf8');
      expect(finalBytes).toBeLessThanOrEqual(MAX_EXIF_RAW_BYTES);
    });
  });

  describe('Extraction with Real Fixture (test_video.mp4)', () => {
    const fixturePath = path.join(__dirname, '../fixtures/test_video.mp4');

    it('extracts metadata dump from real MP4 fixture without System:* tags', async () => {
      if (!fs.existsSync(fixturePath)) {
        return;
      }

      const { rawJson, typedExif } = await extractMetadataDumpFromFile(fixturePath);
      expect(rawJson).not.toBeNull();
      expect(rawJson?.exiftool_version).toBeDefined();
      expect(rawJson?.extracted_at).toBeDefined();

      // System:* tags must be absent
      const tagKeys = Object.keys(rawJson?.tags || {});
      const hasSystemTags = tagKeys.some((k) => k.startsWith('System:'));
      expect(hasSystemTags).toBe(false);

      // SourceFile must be absent
      expect(rawJson?.tags.SourceFile).toBeUndefined();

      // Dimensions extracted from MP4 track
      expect(typedExif.exifWidth).toBe(16);
      expect(typedExif.exifHeight).toBe(16);
    });

    it('extracts metadata dump from buffer', async () => {
      if (!fs.existsSync(fixturePath)) {
        return;
      }
      const buffer = fs.readFileSync(fixturePath);
      const { rawJson, typedExif } = await extractMetadataDumpFromBuffer(buffer);
      expect(rawJson).not.toBeNull();
      expect(typedExif.exifWidth).toBe(16);
      expect(typedExif.exifHeight).toBe(16);
    });
  });

  describe('Fail-soft Handling', () => {
    it('returns null rawJson and empty typedExif on invalid file or failure', async () => {
      const { rawJson, typedExif } = await extractMetadataDumpFromFile(
        '/non/existent/path/media.jpg'
      );
      expect(rawJson).toBeNull();
      expect(typedExif).toEqual({
        exifMake: null,
        exifModel: null,
        exifAltitude: null,
        exifBearing: null,
        exifWidth: null,
        exifHeight: null,
      });
    });

    it('stays fail-soft on timeout failure (null rawJson, empty typedExif)', async () => {
      const childProcess = require('child_process');
      const spy = jest.spyOn(childProcess, 'execFile').mockImplementation((...args: any[]) => {
        const cb = args[args.length - 1];
        const timeoutErr: any = new Error('Command failed: exiftool timed out after 30000ms');
        timeoutErr.code = 'ETIMEDOUT';
        timeoutErr.killed = true;
        cb(timeoutErr, '', '');
      });

      try {
        const { rawJson, typedExif } = await extractMetadataDumpFromFile('/path/to/hung.mp4');
        expect(rawJson).toBeNull();
        expect(typedExif).toEqual({
          exifMake: null,
          exifModel: null,
          exifAltitude: null,
          exifBearing: null,
          exifWidth: null,
          exifHeight: null,
        });
      } finally {
        spy.mockRestore();
      }
    });

    it('stays fail-soft on maxBuffer exceeded failure (null rawJson, empty typedExif)', async () => {
      const childProcess = require('child_process');
      const spy = jest.spyOn(childProcess, 'execFile').mockImplementation((...args: any[]) => {
        const cb = args[args.length - 1];
        const maxBufferErr: any = new Error('stdout maxBuffer length exceeded');
        maxBufferErr.code = 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER';
        cb(maxBufferErr, '', '');
      });

      try {
        const { rawJson, typedExif } = await extractMetadataDumpFromFile('/path/to/overflow.jpg');
        expect(rawJson).toBeNull();
        expect(typedExif).toEqual({
          exifMake: null,
          exifModel: null,
          exifAltitude: null,
          exifBearing: null,
          exifWidth: null,
          exifHeight: null,
        });
      } finally {
        spy.mockRestore();
      }
    });
  });

  describe('Repository Persistence (insertNetworkMedia)', () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });

    it('passes exif_raw json and typed columns to database INSERT query', async () => {
      (query as jest.Mock).mockResolvedValueOnce({ rows: [] }); // duplicate check
      (adminQuery as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: 101, filename: 'test.jpg', file_size: 1234, created_at: new Date() }],
      });

      const buffer = Buffer.from('dummy image bytes');
      const fakeRawJson = {
        exiftool_version: '13.25',
        extracted_at: '2026-10-05T21:00:00.000Z',
        tags: { 'IFD0:Make': 'Canon' },
      };

      await insertNetworkMedia(
        '00:11:22:33:44:55',
        'image',
        'test.jpg',
        buffer.length,
        'image/jpeg',
        buffer,
        'Test Description',
        37.7749,
        -122.4194,
        '2026-10-05 15:30:00',
        null,
        12345,
        fakeRawJson,
        'Canon',
        'EOS R5',
        100.5,
        90.0,
        8192,
        5464
      );

      expect(adminQuery).toHaveBeenCalledTimes(1);
      const sql = (adminQuery as jest.Mock).mock.calls[0][0];
      const params = (adminQuery as jest.Mock).mock.calls[0][1];

      expect(sql).toContain('exif_raw');
      expect(sql).toContain('exif_make');
      expect(sql).toContain('exif_model');
      expect(sql).toContain('exif_altitude');
      expect(sql).toContain('exif_bearing');
      expect(sql).toContain('exif_width');
      expect(sql).toContain('exif_height');

      // Check parameter positions
      expect(params[13]).toBe(JSON.stringify(fakeRawJson));
      expect(params[14]).toBe('Canon');
      expect(params[15]).toBe('EOS R5');
      expect(params[16]).toBe(100.5);
      expect(params[17]).toBe(90.0);
      expect(params[18]).toBe(8192);
      expect(params[19]).toBe(5464);
    });
  });

  describe('Regression: Required Field Rejection Unchanged', () => {
    it('throws ExifMissingError when GPS or timestamp fields are absent', async () => {
      const dummyPath = path.join(__dirname, '../fixtures/test_video_missing_telemetry.mp4');
      if (fs.existsSync(dummyPath)) {
        await expect(extractExif(dummyPath)).rejects.toThrow(ExifMissingError);
      }
    });
  });

  describe('Backfill Script Preflight & --confirm-db Guard', () => {
    it('extracts connection metadata from mocked query result', async () => {
      const mockQuery = jest.fn().mockResolvedValueOnce({
        rows: [
          {
            current_database: 'shadowcheck_test',
            current_user: 'shadowcheck_admin',
            server_addr: '127.0.0.1',
            server_port: '5432',
          },
        ],
      });

      const meta = await fetchConnectionMetadata(mockQuery);
      expect(meta).toEqual({
        currentDatabase: 'shadowcheck_test',
        currentUser: 'shadowcheck_admin',
        serverAddr: '127.0.0.1',
        serverPort: '5432',
      });
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('current_database()'));
    });

    it('parses --confirm-db argument from CLI flags', () => {
      expect(parseConfirmDbArg(['node', 'script.ts', '--confirm-db=shadowcheck_test'])).toBe(
        'shadowcheck_test'
      );
      expect(parseConfirmDbArg(['node', 'script.ts', '--apply'])).toBeUndefined();
    });

    it('passes preflight when databases match in dry-run mode without --confirm-db', () => {
      const readMeta = {
        currentDatabase: 'shadowcheck_test',
        currentUser: 'shadowcheck_user',
        serverAddr: '127.0.0.1',
        serverPort: '5432',
      };
      const adminMeta = {
        currentDatabase: 'shadowcheck_test',
        currentUser: 'shadowcheck_admin',
        serverAddr: '127.0.0.1',
        serverPort: '5432',
      };

      expect(() => validatePreflight(readMeta, adminMeta, false)).not.toThrow();
    });

    it('aborts when read and admin query target different databases', () => {
      const readMeta = {
        currentDatabase: 'shadowcheck_test',
        currentUser: 'shadowcheck_user',
        serverAddr: '127.0.0.1',
        serverPort: '5432',
      };
      const adminMeta = {
        currentDatabase: 'shadowcheck_db', // Dev DB mismatch!
        currentUser: 'shadowcheck_admin',
        serverAddr: '127.0.0.1',
        serverPort: '5432',
      };

      expect(() => validatePreflight(readMeta, adminMeta, false)).toThrow(
        /Database mismatch: read query connects to 'shadowcheck_test', but admin query connects to 'shadowcheck_db'/
      );
    });

    it('aborts on --apply when --confirm-db is missing', () => {
      const meta = {
        currentDatabase: 'shadowcheck_test',
        currentUser: 'shadowcheck_user',
        serverAddr: '127.0.0.1',
        serverPort: '5432',
      };

      expect(() => validatePreflight(meta, meta, true, undefined)).toThrow(
        /--apply requires explicit --confirm-db=<database_name>/
      );
    });

    it('aborts on --apply when --confirm-db does not match current_database', () => {
      const meta = {
        currentDatabase: 'shadowcheck_test',
        currentUser: 'shadowcheck_user',
        serverAddr: '127.0.0.1',
        serverPort: '5432',
      };

      expect(() => validatePreflight(meta, meta, true, 'shadowcheck_db')).toThrow(
        /--confirm-db='shadowcheck_db' does not match connected database 'shadowcheck_test'/
      );
    });

    it('passes preflight on --apply when --confirm-db matches current_database', () => {
      const readMeta = {
        currentDatabase: 'shadowcheck_test',
        currentUser: 'shadowcheck_user',
        serverAddr: '127.0.0.1',
        serverPort: '5432',
      };
      const adminMeta = {
        currentDatabase: 'shadowcheck_test',
        currentUser: 'shadowcheck_admin',
        serverAddr: '127.0.0.1',
        serverPort: '5432',
      };

      expect(() => validatePreflight(readMeta, adminMeta, true, 'shadowcheck_test')).not.toThrow();
    });

    it('prints abort message to stderr and calls exit(1) on missing --confirm-db', async () => {
      query.mockResolvedValueOnce({
        rows: [
          {
            current_database: 'shadowcheck_test',
            current_user: 'shadowcheck_user',
            server_addr: '127.0.0.1',
            server_port: '5432',
          },
        ],
      });
      adminQuery.mockResolvedValueOnce({
        rows: [
          {
            current_database: 'shadowcheck_test',
            current_user: 'shadowcheck_admin',
            server_addr: '127.0.0.1',
            server_port: '5432',
          },
        ],
      });

      const mockExit = jest.fn();
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await main(['node', 'script.ts', '--apply'], mockExit);

      expect(mockExit).toHaveBeenCalledWith(1);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Backfill aborted: --apply requires explicit --confirm-db=<database_name>'
        )
      );
      errorSpy.mockRestore();
    });

    it('prints abort message to stderr and calls exit(1) on mismatched --confirm-db', async () => {
      query.mockResolvedValueOnce({
        rows: [
          {
            current_database: 'shadowcheck_test',
            current_user: 'shadowcheck_user',
            server_addr: '127.0.0.1',
            server_port: '5432',
          },
        ],
      });
      adminQuery.mockResolvedValueOnce({
        rows: [
          {
            current_database: 'shadowcheck_test',
            current_user: 'shadowcheck_admin',
            server_addr: '127.0.0.1',
            server_port: '5432',
          },
        ],
      });

      const mockExit = jest.fn();
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await main(['node', 'script.ts', '--apply', '--confirm-db=shadowcheck_db'], mockExit);

      expect(mockExit).toHaveBeenCalledWith(1);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          "Backfill aborted: --confirm-db='shadowcheck_db' does not match connected database 'shadowcheck_test'"
        )
      );
      errorSpy.mockRestore();
    });

    it('prints abort message to stderr and calls exit(1) on read/admin DB mismatch', async () => {
      query.mockResolvedValueOnce({
        rows: [
          {
            current_database: 'shadowcheck_test',
            current_user: 'shadowcheck_user',
            server_addr: '127.0.0.1',
            server_port: '5432',
          },
        ],
      });
      adminQuery.mockResolvedValueOnce({
        rows: [
          {
            current_database: 'shadowcheck_db',
            current_user: 'shadowcheck_admin',
            server_addr: '127.0.0.1',
            server_port: '5432',
          },
        ],
      });

      const mockExit = jest.fn();
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await main(['node', 'script.ts'], mockExit);

      expect(mockExit).toHaveBeenCalledWith(1);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          "Backfill aborted: Database mismatch: read query connects to 'shadowcheck_test', but admin query connects to 'shadowcheck_db'"
        )
      );
      errorSpy.mockRestore();
    });

    it('does not double-print errors already logged inside the try block', async () => {
      query
        .mockResolvedValueOnce({
          rows: [
            {
              current_database: 'shadowcheck_test',
              current_user: 'shadowcheck_user',
              server_addr: '127.0.0.1',
              server_port: '5432',
            },
          ],
        })
        .mockRejectedValueOnce(new Error('Database disk failure during pagination'));
      adminQuery.mockResolvedValueOnce({
        rows: [
          {
            current_database: 'shadowcheck_test',
            current_user: 'shadowcheck_admin',
            server_addr: '127.0.0.1',
            server_port: '5432',
          },
        ],
      });

      const mockExit = jest.fn();
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await main(['node', 'script.ts'], mockExit);

      expect(mockExit).toHaveBeenCalledWith(1);
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith(
        'Backfill error:',
        'Database disk failure during pagination'
      );
      errorSpy.mockRestore();
    });
  });
});
