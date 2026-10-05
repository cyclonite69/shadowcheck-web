import { extractVideoTelemetry } from '../../server/src/services/visint/visintVideoExif';
import { generateThumbnail } from '../../server/src/services/visint/visintPipeline';

import * as child_process from 'child_process';
import sharp from 'sharp';

jest.mock('child_process', () => ({
  execFile: jest.fn(),
}));

jest.mock('sharp', () => jest.fn());

describe('visintVideoExif', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('extracts GPS and container creation time (ffmpeg fixture style)', async () => {
    (child_process.execFile as unknown as jest.Mock).mockImplementation((cmd, args, callback) => {
      callback(null, {
        stdout: JSON.stringify([
          {
            'QuickTime:CreateDate': '2025:10:12 05:03:35',
            'QuickTime:Duration': 14.82,
            'Composite:GPSLatitude': 12.3456,
            'Composite:GPSLongitude': -78.9012,
          },
        ]),
      });
    });

    const result = await extractVideoTelemetry('dummy.mp4', 'dummy.mp4');
    expect(result.lat).toBe(12.3456);
    expect(result.lon).toBe(-78.9012);
    expect(result.duration_s).toBe(14.82);
    // creation time minus duration -> 2025-10-12T05:03:20.180Z
    expect(result.timestamp).toBe('2025-10-12T05:03:20.180Z');
    expect(result.timestamp_source).toBe('container_creation_minus_duration');
    expect(result.timestamp_is_start_estimate).toBe(true);
    expect(child_process.execFile).toHaveBeenCalledWith(
      'exiftool',
      expect.arrayContaining(['-api', 'QuickTimeUTC=0']),
      expect.any(Function)
    );
  });

  it('extracts GPS and container creation time (real tag set)', async () => {
    (child_process.execFile as unknown as jest.Mock).mockImplementation((cmd, args, callback) => {
      callback(null, {
        stdout: JSON.stringify([
          {
            'QuickTime:CreateDate': '2025:10:12 05:03:35',
            'QuickTime:Duration': 14.8201,
            'Keys:AndroidTimeZone': '-0400',
            'UserData:GPSCoordinates': '12.3456 -78.9012',
            'Composite:GPSLatitude': 12.3456,
            'Composite:GPSLongitude': -78.9012,
          },
        ]),
      });
    });

    const result = await extractVideoTelemetry('dummy.mp4', 'dummy.mp4');
    expect(result.lat).toBe(12.3456);
    expect(result.lon).toBe(-78.9012);
    expect(result.duration_s).toBe(14.8201);
    expect(result.timestamp).toBe('2025-10-12T05:03:20.180Z'); // 35 - 14.8201 = 20.1799 -> ~20.180
    expect(result.timestamp_source).toBe('container_creation_minus_duration');
    expect(result.timestamp_is_start_estimate).toBe(true);
  });

  it('treats an unzoned MP4 container timestamp as UTC without estimating a start', async () => {
    (child_process.execFile as unknown as jest.Mock).mockImplementation((cmd, args, callback) => {
      callback(null, {
        stdout: JSON.stringify([
          {
            'QuickTime:CreateDate': '2025:10:12 05:03:35',
            'QuickTime:Duration': 0,
            'Composite:GPSLatitude': 43.0147,
            'Composite:GPSLongitude': -83.6895,
          },
        ]),
      });
    });

    const result = await extractVideoTelemetry('dummy.mp4', 'dummy.mp4');

    expect(result.timestamp).toBe('2025-10-12T05:03:35.000Z');
    expect(result.timestamp_source).toBe('container_creation');
    expect(result.timestamp_is_start_estimate).toBe(false);
    expect(child_process.execFile).toHaveBeenCalledWith(
      'exiftool',
      expect.arrayContaining(['-api', 'QuickTimeUTC=0']),
      expect.any(Function)
    );
  });

  it('falls back to filename if container time is empty, using utc_offset', async () => {
    (child_process.execFile as unknown as jest.Mock).mockImplementation((cmd, args, callback) => {
      callback(null, {
        stdout: JSON.stringify([
          {
            'QuickTime:CreateDate': '0000:00:00 00:00:00',
            'Composite:GPSLatitude': 12.3456,
            'Composite:GPSLongitude': -78.9012,
            'Keys:AndroidTimeZone': '-0400',
          },
        ]),
      });
    });

    const result = await extractVideoTelemetry('dummy.mp4', '20251012_010318.mp4');
    expect(result.timestamp).toBe('2025-10-12T05:03:18.000Z');
    expect(result.timestamp_source).toBe('filename_with_offset');
    expect(result.timestamp_is_start_estimate).toBe(false);
  });

  it('rejects if filename fallback is needed but no offset tag exists', async () => {
    (child_process.execFile as unknown as jest.Mock).mockImplementation((cmd, args, callback) => {
      callback(null, {
        stdout: JSON.stringify([
          {
            'QuickTime:CreateDate': '0000:00:00 00:00:00',
            'Composite:GPSLatitude': 12.3456,
            'Composite:GPSLongitude': -78.9012,
          },
        ]),
      });
    });

    await expect(extractVideoTelemetry('dummy.mp4', '20251012_010318.mp4')).rejects.toThrow(
      'Missing EXIF telemetry fields: DateTimeOriginal (tried container creation_time, filename fallback rejected due to missing utc_offset)'
    );
  });

  it('rejects if GPS is missing', async () => {
    (child_process.execFile as unknown as jest.Mock).mockImplementation((cmd, args, callback) => {
      callback(null, {
        stdout: JSON.stringify([
          {
            'QuickTime:CreateDate': '2025:10:12 05:03:35',
            'Composite:GPSLatitude': null,
          },
        ]),
      });
    });

    await expect(extractVideoTelemetry('dummy.mp4', 'dummy.mp4')).rejects.toThrow(
      'Missing EXIF telemetry fields: GPSLatitude, GPSLongitude'
    );
  });

  it('rejects if no usable timestamp from any source', async () => {
    (child_process.execFile as unknown as jest.Mock).mockImplementation((cmd, args, callback) => {
      callback(null, {
        stdout: JSON.stringify([
          {
            'QuickTime:CreateDate': '0000:00:00 00:00:00',
            'Composite:GPSLatitude': 12.3456,
            'Composite:GPSLongitude': -78.9012,
          },
        ]),
      });
    });

    await expect(extractVideoTelemetry('dummy.mp4', 'dummy.mp4')).rejects.toThrow(
      'Missing EXIF telemetry fields: DateTimeOriginal (tried container creation_time, filename+utc_offset)'
    );
  });

  it('returns a null MP4 thumbnail without invoking Sharp', async () => {
    await expect(generateThumbnail(Buffer.from('mp4-content'), 'video/mp4')).resolves.toBeNull();
    expect(sharp).not.toHaveBeenCalled();
  });
});
