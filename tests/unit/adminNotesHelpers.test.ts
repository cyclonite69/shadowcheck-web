import express from 'express';
import request from 'supertest';

const { createSecurityHeaders } = require('../../server/src/middleware/securityHeaders');

const {
  mediaUpload,
  handleNoteMediaUpload,
  serveNoteMedia,
} = require('../../server/src/api/routes/v1/admin/adminNotesHelpers');

const mockService = {
  getNetworkNoteById: jest.fn(),
  addNoteMedia: jest.fn(),
  getNoteMediaById: jest.fn(),
};

const makePng = () => {
  const buffer = Buffer.alloc(45);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(buffer);
  buffer.writeUInt32BE(13, 8);
  buffer.write('IHDR', 12, 'ascii');
  buffer.writeUInt32BE(0, 33);
  buffer.write('IEND', 37, 'ascii');
  return buffer;
};

const makeIsoBmff = (brand: string) => {
  const buffer = Buffer.alloc(24);
  buffer.writeUInt32BE(16, 0);
  buffer.write('ftyp', 4, 'ascii');
  buffer.write(brand, 8, 'ascii');
  buffer.writeUInt32BE(8, 16);
  buffer.write('mdat', 20, 'ascii');
  return buffer;
};

const makeWebp = () => {
  const buffer = Buffer.alloc(30);
  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(22, 4);
  buffer.write('WEBPVP8 ', 8, 'ascii');
  buffer.writeUInt32LE(10, 16);
  return buffer;
};

const makeAvi = () => {
  const buffer = Buffer.alloc(24);
  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(16, 4);
  buffer.write('AVI ', 8, 'ascii');
  buffer.write('LIST', 12, 'ascii');
  buffer.writeUInt32LE(4, 16);
  buffer.write('hdrl', 20, 'ascii');
  return buffer;
};

const sampleMedia: Record<string, { contentType: string; bytes: Buffer; mimeType: string }> = {
  'photo.jpg': {
    contentType: 'image/jpeg',
    bytes: Buffer.from('ffd8ffe000104a46494600010100000100010000ffd9', 'hex'),
    mimeType: 'image/jpeg',
  },
  'photo.jpeg': {
    contentType: 'image/jpeg',
    bytes: Buffer.from('ffd8ffe000104a46494600010100000100010000ffd9', 'hex'),
    mimeType: 'image/jpeg',
  },
  'photo.png': {
    contentType: 'image/png',
    bytes: makePng(),
    mimeType: 'image/png',
  },
  'photo.gif': {
    contentType: 'image/gif',
    bytes: Buffer.concat([
      Buffer.from('GIF89a'),
      Buffer.from([1, 0, 1, 0, 0, 0, 0, 0x2c, 0, 0, 0, 0, 1, 0, 1, 0, 0, 2, 1, 0, 0, 0x3b]),
    ]),
    mimeType: 'image/gif',
  },
  'photo.webp': {
    contentType: 'image/webp',
    bytes: makeWebp(),
    mimeType: 'image/webp',
  },
  'photo.heic': {
    contentType: 'image/heic',
    bytes: makeIsoBmff('heic'),
    mimeType: 'image/heic',
  },
  'photo.heif': {
    contentType: 'image/heif',
    bytes: makeIsoBmff('mif1'),
    mimeType: 'image/heif',
  },
  'document.pdf': {
    contentType: 'application/pdf',
    bytes: Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n'),
    mimeType: 'application/pdf',
  },
  'clip.mp4': {
    contentType: 'video/mp4',
    bytes: makeIsoBmff('isom'),
    mimeType: 'video/mp4',
  },
  'clip.mov': {
    contentType: 'video/quicktime',
    bytes: makeIsoBmff('qt  '),
    mimeType: 'video/quicktime',
  },
  'clip.avi': {
    contentType: 'video/x-msvideo',
    bytes: makeAvi(),
    mimeType: 'video/x-msvideo',
  },
};

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

const app = express();
app.use(express.json());
app.use(createSecurityHeaders(false));

// Routes to test helpers
app.post(
  '/test-upload/:noteId',
  mediaUpload.single('file'),
  async (req: any, res: any, next: any) => {
    try {
      await handleNoteMediaUpload(req, res, mockService, mockLogger);
    } catch (err) {
      next(err);
    }
  }
);

app.get('/test-serve/:filename', async (req: any, res: any, next: any) => {
  try {
    await serveNoteMedia(req, res, mockService, mockLogger);
  } catch (err) {
    next(err);
  }
});

// Error handling middleware to format errors as JSON
app.use((err: any, req: any, res: any, _next: any) => {
  res.status(err.status || 500).json({ ok: false, error: err.message });
});

describe('adminNotesHelpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fileFilter in mediaUpload', () => {
    it('rejects disallowed file types with a client error', async () => {
      const res = await request(app)
        .post('/test-upload/1')
        .attach('file', Buffer.from('dummy'), 'test.exe');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('No file provided');
    });

    it('accepts each allowlisted signature and persists bytes only', async () => {
      mockService.getNetworkNoteById.mockResolvedValueOnce({
        id: 8,
        bssid: 'AA:BB:CC:DD:EE:FF',
      });
      for (const [index, [filename, sample]] of Object.entries(sampleMedia).entries()) {
        mockService.getNetworkNoteById.mockResolvedValueOnce({
          id: 8,
          bssid: 'AA:BB:CC:DD:EE:FF',
        });
        mockService.addNoteMedia.mockResolvedValueOnce({
          id: 100 + index,
          file_name: filename,
          file_size: sample.bytes.length,
          mime_type: sample.mimeType,
        });

        const res = await request(app)
          .post('/test-upload/8')
          .field('bssid', 'bad:bssid:value:00')
          .attach('file', sample.bytes, { filename, contentType: sample.contentType });

        if (res.status !== 200) {
          throw new Error(`Rejected valid fixture ${filename}: ${res.body.error}`);
        }
        expect(res.status).toBe(200);
        expect(res.body.mime_type).toBe(sample.mimeType);
        expect(res.body).not.toHaveProperty('file_path');
        expect(mockService.addNoteMedia).toHaveBeenLastCalledWith(
          '8',
          'AA:BB:CC:DD:EE:FF',
          filename,
          sample.bytes.length,
          sample.mimeType.startsWith('video/')
            ? 'video'
            : sample.mimeType === 'application/pdf'
              ? 'document'
              : 'image',
          sample.bytes,
          sample.mimeType
        );
      }
      expect(mockService.getNetworkNoteById).toHaveBeenCalledWith('8');
    });

    it.each([
      ['active.svg', Buffer.from('<svg/>'), 'image/svg+xml'],
      ['active.html', Buffer.from('<html>bad</html>'), 'image/png'],
      ['photo.jpg', Buffer.from('garbage'), 'image/jpeg'],
      ['photo.png', Buffer.from('%PDF-1.7'), 'image/png'],
      ['photo.jpg', Buffer.from([0xff, 0xd8, 0xff]), 'image/jpeg'],
      ['photo.png', Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), 'image/png'],
      ['document.pdf', Buffer.from('%PDF-1.7'), 'application/pdf'],
      ['clip.mp4', Buffer.from('0000ftypisom'), 'video/mp4'],
    ])('rejects unsafe content or extension mismatch for %s', async (filename, bytes, mime) => {
      const res = await request(app)
        .post('/test-upload/8')
        .attach('file', bytes as Buffer, { filename, contentType: mime });

      expect(res.status).toBe(400);
      expect(mockService.addNoteMedia).not.toHaveBeenCalled();
    });

    it('stores the detected MIME rather than a spoofed client MIME', async () => {
      mockService.getNetworkNoteById.mockResolvedValueOnce({
        id: 8,
        bssid: 'AA:BB:CC:DD:EE:FF',
      });
      mockService.addNoteMedia.mockResolvedValueOnce({ id: 125, file_name: 'real.png' });

      const res = await request(app)
        .post('/test-upload/8')
        .attach('file', sampleMedia['photo.png'].bytes, {
          filename: 'real.png',
          contentType: 'text/html',
        });

      expect(res.status).toBe(200);
      expect(mockService.addNoteMedia).toHaveBeenCalledWith(
        '8',
        'AA:BB:CC:DD:EE:FF',
        'real.png',
        sampleMedia['photo.png'].bytes.length,
        'image',
        sampleMedia['photo.png'].bytes,
        'image/png'
      );
    });
  });

  describe('handleNoteMediaUpload', () => {
    it('returns 400 if no file provided', async () => {
      const res = await request(app).post('/test-upload/1').send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('No file provided');
    });

    it('returns 404 if note not found', async () => {
      mockService.getNetworkNoteById.mockResolvedValueOnce(null);

      const res = await request(app)
        .post('/test-upload/1')
        .attach('file', sampleMedia['photo.jpg'].bytes, 'test.jpg');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Note not found');
    });

    it('returns storage errors without writing files', async () => {
      mockService.getNetworkNoteById.mockResolvedValueOnce({
        id: 8,
        bssid: 'AA:BB:CC:DD:EE:FF',
      });
      mockService.addNoteMedia.mockRejectedValueOnce({
        code: '23502',
        message: 'note media insert failed',
      });

      const res = await request(app)
        .post('/test-upload/8')
        .attach('file', sampleMedia['photo.jpg'].bytes, 'test.jpg');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('note media insert failed');
      expect(res.body.error).not.toBe('Invalid BSSID: network not found');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('serveNoteMedia', () => {
    it('serves database media data directly if present', async () => {
      mockService.getNoteMediaById.mockResolvedValueOnce({
        id: 201,
        media_data: Buffer.from('binary-data'),
        mime_type: 'image/png',
        file_name: 'db-file.png',
      });

      const res = await request(app).get('/test-serve/201');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('image/png');
      expect(res.headers['content-disposition']).toBe('inline; filename="db-file.png"');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['content-security-policy']).toBe('sandbox');
      expect(res.body.toString()).toBe('binary-data');
    });

    it.each([
      ['application/pdf', 'inline', false],
      ['image/heic', 'attachment', true],
      ['image/heif', 'attachment', true],
      ['video/x-msvideo', 'attachment', true],
      ['application/svg+xml', 'attachment', true],
    ])('sets safe response headers for stored MIME %s', async (mimeType, disposition, sandbox) => {
      mockService.getNoteMediaById.mockResolvedValueOnce({
        id: 206,
        media_data: Buffer.from('payload'),
        mime_type: mimeType,
        file_name: 'sample.bin',
      });

      const res = await request(app).get('/test-serve/206');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain(
        ['image/heic', 'image/heif', 'video/x-msvideo'].includes(mimeType)
          ? mimeType
          : mimeType === 'application/svg+xml'
            ? 'application/octet-stream'
            : mimeType
      );
      expect(res.headers['content-disposition']).toBe(`${disposition}; filename="sample.bin"`);
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      if (sandbox) {
        expect(res.headers['content-security-policy']).toBe('sandbox');
      } else {
        expect(res.headers['content-security-policy']).not.toContain('sandbox');
      }
    });

    it.each([
      ['image/jpeg', 'inline'],
      ['image/png', 'inline'],
      ['image/gif', 'inline'],
      ['image/webp', 'inline'],
      ['video/mp4', 'inline'],
      ['video/quicktime', 'inline'],
      ['image/heif', 'attachment'],
      ['video/x-msvideo', 'attachment'],
    ])('uses %s MIME and %s disposition for allowlisted stored types', async (mimeType, mode) => {
      mockService.getNoteMediaById.mockResolvedValueOnce({
        id: 209,
        media_data: Buffer.from('payload'),
        mime_type: mimeType,
        file_name: 'media-file',
      });

      const res = await request(app).get('/test-serve/209');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain(mimeType);
      expect(res.headers['content-disposition']).toBe(`${mode}; filename="media-file"`);
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      if (mimeType === 'application/pdf') {
        expect(res.headers['content-security-policy']).not.toContain('sandbox');
      } else {
        expect(res.headers['content-security-policy']).toBe('sandbox');
      }
    });

    it('sends PDF inline without applying sandbox to Chrome PDF viewer', async () => {
      mockService.getNoteMediaById.mockResolvedValueOnce({
        id: 207,
        media_data: sampleMedia['document.pdf'].bytes,
        mime_type: 'application/pdf',
        file_name: 'report.pdf',
      });

      const res = await request(app).get('/test-serve/207');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');
      expect(res.headers['content-disposition']).toBe('inline; filename="report.pdf"');
      expect(res.headers['content-security-policy']).not.toContain('sandbox');
    });

    it('serves an unsupported stored MIME as an attachment with an octet-stream type', async () => {
      mockService.getNoteMediaById.mockResolvedValueOnce({
        id: 208,
        media_data: Buffer.from('payload'),
        mime_type: 'text/html',
        file_name: 'payload.html',
      });

      const res = await request(app).get('/test-serve/208');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/octet-stream');
      expect(res.headers['content-disposition']).toBe('attachment; filename="payload.html"');
      expect(res.headers['content-security-policy']).toBe('sandbox');
    });

    it('does not serve filesystem paths or query the database for non-ID names', async () => {
      const res = await request(app).get('/test-serve/legacy-file.pdf');

      expect(res.status).toBe(404);
      expect(mockService.getNoteMediaById).not.toHaveBeenCalled();
    });

    it('returns 404 if media record not found by id', async () => {
      mockService.getNoteMediaById.mockResolvedValueOnce(null);

      const res = await request(app).get('/test-serve/999');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Media not found');
    });

    it('does not resolve a filesystem path for traversal attempts', async () => {
      const res = await request(app).get('/test-serve/..%2fescaped');
      expect(res.status).toBe(404);
      expect(mockService.getNoteMediaById).not.toHaveBeenCalled();
    });

    it('returns 500 on unexpected errors', async () => {
      mockService.getNoteMediaById.mockRejectedValueOnce(new Error('Fatal'));

      const res = await request(app).get('/test-serve/500');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to serve media');
    });
  });
});
