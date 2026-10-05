import express from 'express';
import request from 'supertest';

const adminNetworkMediaService = {
  checkDuplicateMedia: jest.fn().mockResolvedValue(null),
  uploadNetworkMedia: jest.fn(),
  getNetworkMediaList: jest.fn(),
  getNetworkMediaFile: jest.fn(),
};
const logger = {
  error: jest.fn(),
};

jest.mock('../../server/src/config/container', () => ({
  adminNetworkMediaService,
}));

jest.mock('../../server/src/logging/logger', () => logger);

const {
  extractMetadataDumpFromBuffer,
} = require('../../server/src/services/visint/visintMetadataDump');

jest.mock('../../server/src/services/visint/visintMetadataDump', () => ({
  extractMetadataDumpFromBuffer: jest.fn(),
}));

const router = require('../../server/src/api/routes/v1/admin/media');

const app = express();
app.use(express.json());
app.use('/api', router);
app.use((error: Error, _req: unknown, res: express.Response, _next: express.NextFunction) => {
  res.status(500).json({ error: error.message });
});

describe('admin media routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    adminNetworkMediaService.checkDuplicateMedia.mockResolvedValue(null);
    (extractMetadataDumpFromBuffer as jest.Mock).mockResolvedValue({
      rawJson: {
        exiftool_version: '13.25',
        extracted_at: '2026-10-05T20:00:00.000Z',
        tags: { 'IFD0:Make': 'TestMake' },
      },
      typedExif: {
        exifMake: 'TestMake',
        exifModel: 'TestModel',
        exifAltitude: 100.5,
        exifBearing: 45.0,
        exifWidth: 1920,
        exifHeight: 1080,
      },
    });
  });

  it('validates required upload fields and media type', async () => {
    const missing = await request(app).post('/api/admin/network-media/upload').send({});
    const invalidType = await request(app).post('/api/admin/network-media/upload').send({
      bssid: 'AA:BB:CC:DD:EE:FF',
      media_type: 'document',
      filename: 'evidence.txt',
      media_data_base64: 'ZGF0YQ==',
    });

    expect(missing.status).toBe(400);
    expect(missing.body.error.message).toContain('required');
    expect(invalidType.status).toBe(400);
    expect(invalidType.body.error.message).toContain('image');
    expect(adminNetworkMediaService.uploadNetworkMedia).not.toHaveBeenCalled();
  });

  it('decodes and uploads media', async () => {
    adminNetworkMediaService.checkDuplicateMedia.mockResolvedValueOnce(null);
    adminNetworkMediaService.uploadNetworkMedia.mockResolvedValueOnce({ id: 7 });

    const response = await request(app)
      .post('/api/admin/network-media/upload')
      .send({
        bssid: 'AA:BB:CC:DD:EE:FF',
        media_type: 'image',
        filename: 'evidence.jpg',
        media_data_base64: Buffer.from('image-data').toString('base64'),
        description: 'front door',
        mime_type: 'image/jpeg',
      });

    expect(response.status).toBe(200);
    expect(adminNetworkMediaService.uploadNetworkMedia).toHaveBeenCalledWith(
      'AA:BB:CC:DD:EE:FF',
      'image',
      'evidence.jpg',
      10,
      'image/jpeg',
      Buffer.from('image-data'),
      'front door',
      null,
      null,
      null,
      null,
      null,
      {
        exiftool_version: '13.25',
        extracted_at: '2026-10-05T20:00:00.000Z',
        tags: { 'IFD0:Make': 'TestMake' },
      },
      'TestMake',
      'TestModel',
      100.5,
      45.0,
      1920,
      1080
    );
    expect(response.body).toEqual({
      ok: true,
      message: 'image uploaded successfully',
      media: { id: 7 },
    });
  });

  it('returns 409 if uploaded media is duplicate without spawning upload', async () => {
    adminNetworkMediaService.checkDuplicateMedia.mockResolvedValueOnce(42);

    const response = await request(app)
      .post('/api/admin/network-media/upload')
      .send({
        bssid: 'AA:BB:CC:DD:EE:FF',
        media_type: 'image',
        filename: 'duplicate.jpg',
        media_data_base64: Buffer.from('image-data').toString('base64'),
        description: 'duplicate image',
        mime_type: 'image/jpeg',
      });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('VISINT_DUPLICATE_MEDIA');
    expect(response.body.error.existingId).toBe(42);
    expect(adminNetworkMediaService.uploadNetworkMedia).not.toHaveBeenCalled();
    expect(extractMetadataDumpFromBuffer).not.toHaveBeenCalled();
  });

  it('logs upload failures and forwards them', async () => {
    adminNetworkMediaService.uploadNetworkMedia.mockRejectedValueOnce(new Error('write failed'));

    const response = await request(app).post('/api/admin/network-media/upload').send({
      bssid: 'AA:BB:CC:DD:EE:FF',
      media_type: 'video',
      filename: 'evidence.mp4',
      media_data_base64: 'ZGF0YQ==',
    });

    expect(response.status).toBe(500);
    expect(response.body.error).toBe('write failed');
    expect(logger.error).toHaveBeenCalledWith('Upload media error: write failed');
  });

  it('lists media for a network', async () => {
    adminNetworkMediaService.getNetworkMediaList.mockResolvedValueOnce([{ id: 1 }, { id: 2 }]);

    const response = await request(app).get('/api/admin/network-media/AA%3ABB%3ACC%3ADD%3AEE%3AFF');

    expect(response.status).toBe(200);
    expect(response.body.count).toBe(2);
    expect(adminNetworkMediaService.getNetworkMediaList).toHaveBeenCalledWith('AA:BB:CC:DD:EE:FF');
  });

  it('downloads media with attachment headers and handles missing media', async () => {
    adminNetworkMediaService.getNetworkMediaFile
      .mockResolvedValueOnce({
        filename: 'evidence.bin',
        mime_type: null,
        media_data: Buffer.from('full'),
      })
      .mockResolvedValueOnce(null);

    const found = await request(app).get('/api/admin/network-media/download/7');
    const missing = await request(app).get('/api/admin/network-media/download/8');

    expect(found.status).toBe(200);
    expect(found.headers['content-type']).toContain('application/octet-stream');
    expect(found.headers['content-disposition']).toBe('attachment; filename="evidence.bin"');
    expect(missing.status).toBe(404);
    expect(missing.body.error.message).toBe('Media not found');
  });

  it('serves a thumbnail inline when requested and falls back to full media', async () => {
    adminNetworkMediaService.getNetworkMediaFile
      .mockResolvedValueOnce({
        filename: 'evidence.jpg',
        mime_type: 'image/jpeg',
        media_data: Buffer.from('full'),
        thumbnail: Buffer.from('thumb'),
      })
      .mockResolvedValueOnce({
        filename: 'evidence.jpg',
        mime_type: null,
        media_data: Buffer.from('full'),
        thumbnail: null,
      })
      .mockResolvedValueOnce(null);

    const thumbnail = await request(app).get('/api/admin/network-media/7/inline?thumbnail=true');
    const full = await request(app).get('/api/admin/network-media/8/inline?thumbnail=true');
    const missing = await request(app).get('/api/admin/network-media/9/inline');

    expect(thumbnail.status).toBe(200);
    expect(thumbnail.body).toEqual(Buffer.from('thumb'));
    expect(thumbnail.headers['content-disposition']).toBe('inline');
    expect(full.headers['content-type']).toContain('image/jpeg');
    expect(full.body).toEqual(Buffer.from('full'));
    expect(missing.status).toBe(404);
  });

  it('forwards list and download service errors', async () => {
    adminNetworkMediaService.getNetworkMediaList.mockRejectedValueOnce(new Error('list failed'));
    adminNetworkMediaService.getNetworkMediaFile.mockRejectedValueOnce(new Error('read failed'));

    const list = await request(app).get('/api/admin/network-media/test');
    const download = await request(app).get('/api/admin/network-media/download/7');

    expect(list.status).toBe(500);
    expect(list.body.error).toBe('list failed');
    expect(download.status).toBe(500);
    expect(download.body.error).toBe('read failed');
  });

  describe('video byte-range streaming (GET /api/admin/network-media/:id/inline)', () => {
    const videoBuffer = Buffer.from('0123456789'); // 10 bytes: offsets 0..9
    const videoMedia = {
      filename: 'traffic_cam.mp4',
      mime_type: 'video/mp4',
      media_type: 'video',
      media_data: videoBuffer,
      thumbnail: null,
    };

    it('returns 206 for bytes=0-3 with correct headers and chunk payload', async () => {
      adminNetworkMediaService.getNetworkMediaFile.mockResolvedValueOnce(videoMedia);

      const res = await request(app)
        .get('/api/admin/network-media/10/inline')
        .set('Range', 'bytes=0-3');

      expect(res.status).toBe(206);
      expect(res.headers['content-range']).toBe('bytes 0-3/10');
      expect(res.headers['content-length']).toBe('4');
      expect(res.headers['content-type']).toContain('video/mp4');
      expect(res.headers['accept-ranges']).toBe('bytes');
      expect(res.headers['content-disposition']).toBe('inline');
      expect(res.body).toEqual(Buffer.from('0123'));
    });

    it('returns 206 for open-ended range bytes=4-', async () => {
      adminNetworkMediaService.getNetworkMediaFile.mockResolvedValueOnce(videoMedia);

      const res = await request(app)
        .get('/api/admin/network-media/10/inline')
        .set('Range', 'bytes=4-');

      expect(res.status).toBe(206);
      expect(res.headers['content-range']).toBe('bytes 4-9/10');
      expect(res.headers['content-length']).toBe('6');
      expect(res.headers['content-type']).toContain('video/mp4');
      expect(res.headers['accept-ranges']).toBe('bytes');
      expect(res.body).toEqual(Buffer.from('456789'));
    });

    it('returns 206 for open-ended range bytes=0-', async () => {
      adminNetworkMediaService.getNetworkMediaFile.mockResolvedValueOnce(videoMedia);

      const res = await request(app)
        .get('/api/admin/network-media/10/inline')
        .set('Range', 'bytes=0-');

      expect(res.status).toBe(206);
      expect(res.headers['content-range']).toBe('bytes 0-9/10');
      expect(res.headers['content-length']).toBe('10');
      expect(res.body).toEqual(Buffer.from('0123456789'));
    });

    it('clamps oversized end offset to totalSize - 1 with 206 status', async () => {
      adminNetworkMediaService.getNetworkMediaFile.mockResolvedValueOnce(videoMedia);

      const res = await request(app)
        .get('/api/admin/network-media/10/inline')
        .set('Range', 'bytes=5-25');

      expect(res.status).toBe(206);
      expect(res.headers['content-range']).toBe('bytes 5-9/10');
      expect(res.headers['content-length']).toBe('5');
      expect(res.body).toEqual(Buffer.from('56789'));
    });

    it('returns 416 with Content-Range bytes */total for out-of-bounds start', async () => {
      adminNetworkMediaService.getNetworkMediaFile.mockResolvedValueOnce(videoMedia);

      const res = await request(app)
        .get('/api/admin/network-media/10/inline')
        .set('Range', 'bytes=10-');

      expect(res.status).toBe(416);
      expect(res.headers['content-range']).toBe('bytes */10');
    });

    it('returns 416 with Content-Range bytes */total for inverted range (start > end)', async () => {
      adminNetworkMediaService.getNetworkMediaFile.mockResolvedValueOnce(videoMedia);

      const res = await request(app)
        .get('/api/admin/network-media/10/inline')
        .set('Range', 'bytes=6-3');

      expect(res.status).toBe(416);
      expect(res.headers['content-range']).toBe('bytes */10');
    });

    it('returns 200 with full video buffer when Range header is absent', async () => {
      adminNetworkMediaService.getNetworkMediaFile.mockResolvedValueOnce(videoMedia);

      const res = await request(app).get('/api/admin/network-media/10/inline');

      expect(res.status).toBe(200);
      expect(res.headers['content-length']).toBe('10');
      expect(res.headers['content-type']).toContain('video/mp4');
      expect(res.headers['accept-ranges']).toBe('bytes');
      expect(res.body).toEqual(videoBuffer);
    });

    it('falls back to 200 with full buffer for unsupported multi-range requests', async () => {
      adminNetworkMediaService.getNetworkMediaFile.mockResolvedValueOnce(videoMedia);

      const res = await request(app)
        .get('/api/admin/network-media/10/inline')
        .set('Range', 'bytes=0-2, 5-8');

      expect(res.status).toBe(200);
      expect(res.headers['content-length']).toBe('10');
      expect(res.body).toEqual(videoBuffer);
    });
  });
});
