const multerLib = require('multer');
const pathLib = require('path');
const fsLib = require('fs');

const NOTES_MEDIA_DIR = pathLib.join(__dirname, '../../../../data/notes-media');

const mediaUpload = multerLib({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req: any, file: any, cb: any) => {
    const allowed = /\.(jpg|jpeg|png|gif|pdf|mp4|mov|avi)$/i;
    if (allowed.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed'));
    }
  },
});

const inferMediaType = (mimetype: string | undefined) =>
  mimetype?.startsWith('video/') ? 'video' : mimetype === 'application/pdf' ? 'document' : 'image';

type MediaService = {
  addNoteMedia: (...args: any[]) => Promise<{ id: number }>;
};

const handleNoteMediaUpload = async (
  req: any,
  res: any,
  service: MediaService,
  logger: typeof import('../../../../logging/logger')
) => {
  const { noteId } = req.params;
  const { bssid } = req.body;
  if (!req.file) {
    return res.status(400).json({ ok: false, error: 'No file provided' });
  }
  const mediaType = inferMediaType(req.file.mimetype);
  const media = await service.addNoteMedia(
    noteId,
    bssid,
    null,
    req.file.originalname,
    req.file.size,
    mediaType,
    req.file.buffer,
    req.file.mimetype || null,
    'db'
  );
  res.json({
    ok: true,
    note_id: noteId,
    media_id: media.id,
    file_path: `/api/media/${media.id}`,
    message: 'Media uploaded',
  });
};

const serveNoteMedia = async (
  req: any,
  res: any,
  service: { getNoteMediaById: (id: string) => Promise<any> },
  logger: typeof import('../../../../logging/logger')
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
