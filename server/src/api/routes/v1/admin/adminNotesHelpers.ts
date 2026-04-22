const multer = require('multer');
const pathLib = require('path');
const fsLib = require('fs');
const { randomUUID } = require('crypto');

const NOTES_MEDIA_DIR = pathLib.join(__dirname, '../../../../data/notes-media');

const mediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req: any, file: any, cb: any) => {
    const allowed = /\.(jpg|jpeg|png|gif|webp|heic|heif|pdf|mp4|mov|avi)$/i;
    const mimetype = String(file.mimetype || '').toLowerCase();
    const allowedMime =
      mimetype.startsWith('image/') ||
      mimetype.startsWith('video/') ||
      mimetype === 'application/pdf';
    if (allowed.test(file.originalname) || allowedMime) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed'));
    }
  },
});

const inferMediaType = (mimetype: string | undefined) =>
  mimetype?.startsWith('video/') ? 'video' : mimetype === 'application/pdf' ? 'document' : 'image';

const ensureNotesMediaDir = async () => {
  await fsLib.promises.mkdir(NOTES_MEDIA_DIR, { recursive: true });
};

const buildStoredFilename = (originalname: string) => {
  const extension = pathLib.extname(String(originalname || '')).toLowerCase();
  const safeExtension = extension || '.bin';
  return `${Date.now()}-${randomUUID()}${safeExtension}`;
};

type MediaService = {
  getNetworkNoteById?: (noteId: string) => Promise<{
    id: number;
    bssid?: string;
  } | null>;
  addNoteMedia: (...args: any[]) => Promise<{
    id: number;
    note_id?: number;
    bssid?: string;
    file_path?: string;
    file_name?: string;
    file_size?: number;
    media_type?: string;
    mime_type?: string;
    storage_backend?: string;
    created_at?: string;
  }>;
};

const handleNoteMediaUpload = async (req: any, res: any, service: MediaService, logger: any) => {
  let savedAbsolutePath: string | null = null;
  try {
    const { noteId } = req.params;
    if (!req.file) {
      return res.status(400).json({ ok: false, error: 'No file provided' });
    }
    const note = await service.getNetworkNoteById?.(noteId);
    if (!note) {
      return res.status(404).json({ ok: false, error: 'Note not found' });
    }

    await ensureNotesMediaDir();
    const storedFilename = buildStoredFilename(req.file.originalname);
    savedAbsolutePath = pathLib.join(NOTES_MEDIA_DIR, storedFilename);
    await fsLib.promises.writeFile(savedAbsolutePath, req.file.buffer);
    const savedFilePath = `/api/media/${storedFilename}`;

    const mediaType = inferMediaType(req.file.mimetype);
    const media = await service.addNoteMedia(
      noteId,
      note.bssid || 'UNKNOWN',
      savedFilePath,
      req.file.originalname,
      req.file.size,
      mediaType,
      null,
      req.file.mimetype || null,
      'file'
    );
    res.json({
      ok: true,
      note_id: noteId,
      media_id: media.id,
      file_path: media.file_path || savedFilePath,
      file_name: media.file_name,
      file_size: media.file_size,
      mime_type: media.mime_type,
      message: 'Media uploaded',
    });
  } catch (error: any) {
    if (savedAbsolutePath) {
      await fsLib.promises.unlink(savedAbsolutePath).catch(() => {});
    }
    logger.error('Note media upload failed:', error);
    const statusCode = 500;
    res.status(statusCode).json({
      ok: false,
      error: error.message || 'Failed to upload media',
      details: error.message,
    });
  }
};

const serveNoteMedia = async (
  req: any,
  res: any,
  service: { getNoteMediaById: (id: string) => Promise<any> },
  logger: any
) => {
  try {
    const { filename } = req.params;
    const isNumericId = /^\d+$/.test(filename);
    if (isNumericId) {
      const media = await service.getNoteMediaById(filename);
      if (!media) {
        return res.status(404).json({ ok: false, error: 'Media not found' });
      }
      if (media.media_data) {
        res.setHeader('Content-Type', media.mime_type || 'application/octet-stream');
        res.setHeader(
          'Content-Disposition',
          `inline; filename="${media.file_name || `media-${media.id}`}"`
        );
        return res.send(media.media_data);
      }
      if (media.file_path) {
        const localName = String(media.file_path).replace('/api/media/', '');
        const filepath = pathLib.join(NOTES_MEDIA_DIR, localName);
        return res.sendFile(filepath);
      }
      return res.status(404).json({ ok: false, error: 'Media payload missing' });
    }

    if (filename.includes('..')) {
      return res.status(403).json({ ok: false, error: 'Access denied' });
    }
    const filepath = pathLib.join(NOTES_MEDIA_DIR, filename);
    if (!fsLib.existsSync(filepath)) {
      return res.status(404).json({ ok: false, error: 'Media not found' });
    }
    return res.sendFile(filepath);
  } catch (error: any) {
    logger.error('Media serve failed:', error);
    return res.status(500).json({ ok: false, error: 'Failed to serve media' });
  }
};

module.exports = {
  mediaUpload,
  handleNoteMediaUpload,
  serveNoteMedia,
};
