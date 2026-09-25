import express from 'express';
import request from 'supertest';

// Mock the fs module cleanly inside the hoisted factory function
jest.mock('fs', () => {
  const mockMkdir = jest.fn().mockImplementation(() => Promise.resolve());
  const mockWriteFile = jest.fn().mockImplementation(() => Promise.resolve());
  const mockUnlink = jest.fn().mockImplementation(() => Promise.resolve());
  const mockExistsSync = jest.fn().mockReturnValue(true);

  return {
    promises: {
      mkdir: mockMkdir,
      writeFile: mockWriteFile,
      unlink: mockUnlink,
    },
    existsSync: mockExistsSync,
  };
});

const fs = require('fs');

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

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

const app = express();
app.use(express.json());

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
    fs.promises.mkdir.mockResolvedValue(undefined);
    fs.promises.writeFile.mockResolvedValue(undefined);
    fs.promises.unlink.mockResolvedValue(undefined);
    fs.existsSync.mockReturnValue(true);
  });

  describe('fileFilter in mediaUpload', () => {
    it('rejects disallowed file types', async () => {
      const res = await request(app)
        .post('/test-upload/1')
        .attach('file', Buffer.from('dummy'), 'test.exe');

      expect(res.status).toBe(500);
      expect(res.body.error).toContain('File type not allowed');
    });

    it('accepts allowed files and uses the note bssid instead of multipart input', async () => {
      mockService.getNetworkNoteById.mockResolvedValueOnce({
        id: 8,
        bssid: 'AA:BB:CC:DD:EE:FF',
      });
      mockService.addNoteMedia.mockResolvedValueOnce({
        id: 101,
        file_name: 'LaFimilaSign.webp',
        file_size: 1234,
        mime_type: 'image/webp',
      });

      const res = await request(app)
        .post('/test-upload/8')
        .field('bssid', 'bad:bssid:value:00')
        .attach('file', Buffer.from('test'), 'LaFimilaSign.webp');

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.media_id).toBe(101);
      expect(mockService.getNetworkNoteById).toHaveBeenCalledWith('8');
      expect(fs.promises.writeFile).toHaveBeenCalledTimes(1);
      expect(mockService.addNoteMedia).toHaveBeenCalledWith(
        '8',
        'AA:BB:CC:DD:EE:FF',
        expect.stringMatching(/^\/api\/media\/.+\.webp$/),
        'LaFimilaSign.webp',
        4,
        'image',
        null,
        'image/webp',
        'file'
      );
      expect(res.body.file_path).toMatch(/^\/api\/media\/.+\.webp$/);
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
        .attach('file', Buffer.from('dummy'), 'test.jpg');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Note not found');
    });

    it('deletes uploaded files without rewriting storage errors', async () => {
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
        .attach('file', Buffer.from('dummy'), 'test.jpg');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('note media insert failed');
      expect(res.body.error).not.toBe('Invalid BSSID: network not found');
      expect(fs.promises.unlink).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('serveNoteMedia', () => {
    it('serves database media data directly if present', async () => {
      mockService.getNoteMediaById.mockResolvedValueOnce({
        id: 201,
        media_data: 'binary-data-stream',
        mime_type: 'text/plain',
        file_name: 'db-file.txt',
      });

      const res = await request(app).get('/test-serve/201');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/plain');
      expect(res.text).toBe('binary-data-stream');
    });

    it('returns 404 if media record not found by id', async () => {
      mockService.getNoteMediaById.mockResolvedValueOnce(null);

      const res = await request(app).get('/test-serve/999');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Media not found');
    });

    it('returns 403 for directory traversal attempts', async () => {
      const res = await request(app).get('/test-serve/..%2fescaped');
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Access denied');
    });

    it('returns 404 if file does not exist on disk', async () => {
      fs.existsSync.mockReturnValueOnce(false);

      const res = await request(app).get('/test-serve/missing.png');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Media not found');
    });

    it('returns 500 on unexpected errors', async () => {
      mockService.getNoteMediaById.mockRejectedValueOnce(new Error('Fatal'));

      const res = await request(app).get('/test-serve/500');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to serve media');
    });
  });
});
