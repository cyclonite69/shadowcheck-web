import request from 'supertest';
import express from 'express';
import { query } from '../../server/src/config/database';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import sharp from 'sharp';

// No container mock needed for E2E testing
jest.mock('../../server/src/logging/logger', () => ({
  error: console.error,
  info: console.log,
  warn: console.warn,
  debug: console.log,
}));

import observationsRouter from '../../server/src/api/routes/v1/networks/observations';
const adminMediaRouter = require('../../server/src/api/routes/v1/admin/media');

import { createErrorHandler } from '../../server/src/errors/errorHandler';
import logger from '../../server/src/logging/logger';

describe('VisINT E2E Pipeline (MP4)', () => {
  let app: any;
  const MP4_FIXTURE_PATH = path.join(__dirname, '../fixtures/test_video.mp4');
  const MP4_MISSING_FIXTURE_PATH = path.join(
    __dirname,
    '../fixtures/test_video_missing_telemetry.mp4'
  );
  const fixtureBuffer = fs.readFileSync(MP4_FIXTURE_PATH);
  const fixtureHash = crypto.createHash('sha256').update(fixtureBuffer).digest('hex');
  let seededSentinel = false;
  let tagWriteAttempted = false;
  let mediaWriteAttempted = false;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use('/api', observationsRouter);
    app.use('/api', adminMediaRouter);
    app.use(createErrorHandler(logger));

    const existingMedia = await query(
      'SELECT id FROM app.network_media WHERE image_sha256 = $1 LIMIT 1',
      [fixtureHash]
    );
    if (existingMedia.rows.length > 0) {
      throw new Error(
        'VISINT MP4 fixture already exists in shadowcheck_test; refusing to alter it.'
      );
    }

    const existingTags = await query('SELECT bssid FROM app.network_tags WHERE bssid = $1', [
      'VISINT_UNMATCHED',
    ]);
    if (existingTags.rows.length > 0) {
      throw new Error('VISINT_UNMATCHED already has network tags; refusing to alter test data.');
    }

    const sentinel = await query('SELECT bssid FROM app.networks WHERE bssid = $1', [
      'VISINT_UNMATCHED',
    ]);
    if (sentinel.rows.length === 0) {
      const seeded = await query(
        `INSERT INTO app.networks (
          bssid, ssid, type, frequency, capabilities, service, rcois, mfgrid,
          lasttime_ms, lastlat, lastlon, bestlevel, bestlat, bestlon, is_sentinel
        ) VALUES (
          'VISINT_UNMATCHED', 'VISINT Unmatched Fallback', 'W', 0, '', '', '', 0,
          0, 0.0, 0.0, 0, 0.0, 0.0, true
        ) ON CONFLICT (bssid) DO NOTHING
        RETURNING bssid`
      );
      seededSentinel = seeded.rows.length > 0;
    }
  });

  afterAll(async () => {
    if (mediaWriteAttempted) {
      await query('DELETE FROM app.network_media WHERE image_sha256 = $1', [fixtureHash]);
    }
    if (tagWriteAttempted) {
      await query('DELETE FROM app.network_tags WHERE bssid = $1', ['VISINT_UNMATCHED']);
    }
    if (seededSentinel) {
      await query('DELETE FROM app.networks WHERE bssid = $1', ['VISINT_UNMATCHED']);
    }
  });

  it('proves valid MP4 telemetry reaches correlation and metadata is stored correctly', async () => {
    mediaWriteAttempted = true;
    tagWriteAttempted = true;
    const response = await request(app)
      .post('/api/observations/correlate-visint')
      .field('commit', 'true')
      .field('confirm_fallback', 'true')
      .field('radius_meters', '0.1')
      .attach('image', MP4_FIXTURE_PATH, { contentType: 'video/mp4' });
    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.status).toBe('UNMATCHED');
    expect(response.body.exif).toBeDefined();
    expect(response.body.exif.lat).toBe(43.0147);
    expect(response.body.exif.lon).toBe(-83.6895);
    expect(response.body.exif.ts).toBe('2025-10-12T05:03:34.960Z');
    expect(response.body.exif.timestamp_source).toBe('container_creation_minus_duration');
    expect(response.body.exif.timestamp_is_start_estimate).toBe(true);
    expect(response.body.exif.duration_s).toBeGreaterThan(0);

    // Verify storage metadata for MP4
    const mediaRes = await query(
      'SELECT id, media_type, mime_type, description, thumbnail, exif_lat, exif_lon, exif_captured_at, image_sha256 FROM app.network_media WHERE image_sha256 = $1',
      [fixtureHash]
    );
    const media = mediaRes.rows[0];
    expect(media.media_type).toBe('video');
    expect(media.mime_type).toBe('video/mp4');
    expect(media.thumbnail).toBeNull();
    expect(Number(media.exif_lat)).toBe(43.0147);
    expect(Number(media.exif_lon)).toBe(-83.6895);
    expect(new Date(media.exif_captured_at).toISOString()).toBe('2025-10-12T05:03:34.960Z');
    expect(media.image_sha256).toBe(fixtureHash);

    const descObj = JSON.parse(media.description);
    expect(descObj.extracted_lat).toBe(43.0147);
    expect(descObj.extracted_lon).toBe(-83.6895);
    expect(descObj.timestamp_source).toBe('container_creation_minus_duration');
    expect(descObj.timestamp_is_start_estimate).toBe(true);
    expect(descObj.duration_s).toBeGreaterThan(0);

    const duplicateSameName = await request(app)
      .post('/api/observations/correlate-visint')
      .field('filename', 'test_video.mp4')
      .field('commit', 'true')
      .field('confirm_fallback', 'true')
      .attach('image', MP4_FIXTURE_PATH, { contentType: 'video/mp4' });
    expect(duplicateSameName.status).toBe(409);
    expect(duplicateSameName.body.code).toBe('VISINT_DUPLICATE_MEDIA');

    const duplicateDifferentName = await request(app)
      .post('/api/observations/correlate-visint')
      .field('filename', 'renamed_video.mp4')
      .field('commit', 'true')
      .field('confirm_fallback', 'true')
      .attach('image', MP4_FIXTURE_PATH, { contentType: 'video/mp4' });
    expect(duplicateDifferentName.status).toBe(409);
    expect(duplicateDifferentName.body.code).toBe('VISINT_DUPLICATE_MEDIA');

    const duplicateThroughAdminUpload = await request(app)
      .post('/api/admin/network-media/upload')
      .send({
        bssid: 'VISINT_UNMATCHED',
        media_type: 'video',
        filename: 'cross_path_copy.mp4',
        mime_type: 'video/mp4',
        media_data_base64: fixtureBuffer.toString('base64'),
      });
    expect(duplicateThroughAdminUpload.status).toBe(409);
    expect(duplicateThroughAdminUpload.body.error.code).toBe('VISINT_DUPLICATE_MEDIA');
  });

  it('rejects MP4 missing telemetry with ExifMissingError, NOT invalid file type', async () => {
    const response = await request(app)
      .post('/api/observations/correlate-visint')
      .field('commit', 'false')
      .attach('image', MP4_MISSING_FIXTURE_PATH, { contentType: 'video/mp4' });

    expect(response.status).toBe(400);
    expect(response.body.ok).toBeFalsy();
    expect(response.body.type).toBe('ExifMissingError');
    expect(response.body.error).toContain('Missing EXIF telemetry fields');
    expect(response.body.code).not.toBe('INVALID_FILE_TYPE');
    expect(response.body.code).not.toBe('VISINT_DUPLICATE_MEDIA');
  });

  it('rejects arbitrary bytes labeled as video/mp4 with INVALID_FILE_TYPE', async () => {
    const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'visint-fake-mp4-'));
    const fakeMp4Path = path.join(tempDirectory, 'fake.mp4');
    fs.writeFileSync(fakeMp4Path, 'this is not a real mp4');

    try {
      const response = await request(app)
        .post('/api/observations/correlate-visint')
        .field('commit', 'false')
        .attach('image', fakeMp4Path, { contentType: 'video/mp4' });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('INVALID_FILE_TYPE');
      expect(response.body.error).toContain('Only JPEG, PNG, and MP4 are allowed');
    } finally {
      fs.rmSync(tempDirectory, { recursive: true, force: true });
    }
  });

  it('rejects an MP4 declaration when the uploaded content is a PNG', async () => {
    const pngBuffer = await sharp({
      create: {
        width: 1,
        height: 1,
        channels: 3,
        background: { r: 0, g: 0, b: 0 },
      },
    })
      .png()
      .toBuffer();

    const response = await request(app)
      .post('/api/observations/correlate-visint')
      .field('commit', 'false')
      .attach('image', pngBuffer, { filename: 'renamed.mp4', contentType: 'video/mp4' });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('INVALID_FILE_TYPE');
  });

  it('rejects mismatched content on the direct attachment route before storage', async () => {
    const pngBuffer = await sharp({
      create: {
        width: 1,
        height: 1,
        channels: 3,
        background: { r: 0, g: 0, b: 0 },
      },
    })
      .png()
      .toBuffer();

    const response = await request(app)
      .post('/api/observations/attach-visint')
      .field('bssid', 'VISINT_UNMATCHED')
      .field('confirm_fallback', 'true')
      .attach('image', pngBuffer, { filename: 'renamed.mp4', contentType: 'video/mp4' });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('INVALID_FILE_TYPE');
  });

  it.each(['image/jpeg', 'image/png'])(
    'accepts valid %s content before reporting its absent telemetry',
    async (mimeType) => {
      const imageBuilder = sharp({
        create: {
          width: 1,
          height: 1,
          channels: 3,
          background: { r: 0, g: 0, b: 0 },
        },
      });
      const imageBuffer =
        mimeType === 'image/jpeg'
          ? await imageBuilder.jpeg().toBuffer()
          : await imageBuilder.png().toBuffer();
      const extension = mimeType === 'image/jpeg' ? 'jpg' : 'png';

      const response = await request(app)
        .post('/api/observations/correlate-visint')
        .field('commit', 'false')
        .attach('image', imageBuffer, {
          filename: `valid.${extension}`,
          contentType: mimeType,
        });

      expect(response.status).toBe(400);
      expect(response.body.type).toBe('ExifMissingError');
      expect(response.body.code).not.toBe('INVALID_FILE_TYPE');
    }
  );

  it.each(['video/webm', 'video/quicktime', 'video/x-msvideo'])(
    'rejects unsupported video MIME type %s',
    async (mimeType) => {
      const response = await request(app)
        .post('/api/observations/correlate-visint')
        .attach('image', MP4_FIXTURE_PATH, {
          filename: `unsupported${mimeType === 'video/webm' ? '.webm' : '.mov'}`,
          contentType: mimeType,
        });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('INVALID_FILE_TYPE');
    }
  );
});
