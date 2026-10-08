const multer = require('multer');
const path = require('path');

const hasIsoBmffBrand = (buffer: Buffer, allowedBrands: string[]) => {
  if (buffer.length < 12 || buffer.toString('ascii', 4, 8) !== 'ftyp') {
    return false;
  }
  const ftypSize = buffer.readUInt32BE(0);
  if (ftypSize < 16 || ftypSize > buffer.length) {
    return false;
  }
  const brands = [buffer.toString('ascii', 8, 12)];
  for (let offset = 16; offset + 4 <= ftypSize; offset += 4) {
    brands.push(buffer.toString('ascii', offset, offset + 4));
  }
  if (!brands.some((brand) => allowedBrands.includes(brand))) {
    return false;
  }

  let offset = ftypSize;
  while (offset + 8 <= buffer.length) {
    const boxSize = buffer.readUInt32BE(offset);
    if (boxSize < 8 || offset + boxSize > buffer.length) {
      return false;
    }
    if (
      ['mdat', 'moov', 'meta', 'moof', 'idat'].includes(
        buffer.toString('ascii', offset + 4, offset + 8)
      )
    ) {
      return true;
    }
    offset += boxSize;
  }
  return false;
};

const hasPngStructure = (buffer: Buffer) =>
  buffer.length >= 45 &&
  buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
  buffer.readUInt32BE(8) === 13 &&
  buffer.toString('ascii', 12, 16) === 'IHDR' &&
  buffer.includes(Buffer.from('IEND'));

const hasAviStructure = (buffer: Buffer) =>
  buffer.length >= 20 &&
  buffer.toString('ascii', 0, 4) === 'RIFF' &&
  buffer.toString('ascii', 8, 12) === 'AVI ' &&
  buffer.readUInt32LE(4) + 8 <= buffer.length &&
  buffer.includes(Buffer.from('LIST'), 12);

const MEDIA_FORMATS = [
  {
    extensions: ['.jpg', '.jpeg'],
    mimeType: 'image/jpeg',
    mediaType: 'image',
    matches: (buffer: Buffer) =>
      buffer.length >= 12 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff &&
      buffer[buffer.length - 2] === 0xff &&
      buffer[buffer.length - 1] === 0xd9,
  },
  {
    extensions: ['.png'],
    mimeType: 'image/png',
    mediaType: 'image',
    matches: hasPngStructure,
  },
  {
    extensions: ['.gif'],
    mimeType: 'image/gif',
    mediaType: 'image',
    matches: (buffer: Buffer) =>
      buffer.length >= 14 &&
      ['GIF87a', 'GIF89a'].includes(buffer.toString('ascii', 0, 6)) &&
      buffer[buffer.length - 1] === 0x3b,
  },
  {
    extensions: ['.webp'],
    mimeType: 'image/webp',
    mediaType: 'image',
    matches: (buffer: Buffer) =>
      buffer.length >= 12 &&
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP' &&
      buffer.readUInt32LE(4) + 8 <= buffer.length &&
      ['VP8 ', 'VP8L', 'VP8X'].includes(buffer.toString('ascii', 12, 16)),
  },
  {
    extensions: ['.heic'],
    mimeType: 'image/heic',
    mediaType: 'image',
    matches: (buffer: Buffer) => hasIsoBmffBrand(buffer, ['heic', 'heix', 'hevc', 'hevx']),
  },
  {
    extensions: ['.heif'],
    mimeType: 'image/heif',
    mediaType: 'image',
    matches: (buffer: Buffer) => hasIsoBmffBrand(buffer, ['mif1', 'msf1']),
  },
  {
    extensions: ['.pdf'],
    mimeType: 'application/pdf',
    mediaType: 'document',
    matches: (buffer: Buffer) =>
      buffer.length >= 20 &&
      buffer.toString('ascii', 0, 5) === '%PDF-' &&
      buffer.lastIndexOf(Buffer.from('%%EOF')) >= 0 &&
      buffer.lastIndexOf(Buffer.from('%%EOF')) >= buffer.length - 1024,
  },
  {
    extensions: ['.mp4'],
    mimeType: 'video/mp4',
    mediaType: 'video',
    matches: (buffer: Buffer) =>
      hasIsoBmffBrand(buffer, [
        'isom',
        'iso2',
        'iso5',
        'iso6',
        'mp41',
        'mp42',
        'avc1',
        'M4V ',
        'M4A ',
        'dash',
        'MSNV',
      ]),
  },
  {
    extensions: ['.mov'],
    mimeType: 'video/quicktime',
    mediaType: 'video',
    matches: (buffer: Buffer) => hasIsoBmffBrand(buffer, ['qt  ']),
  },
  {
    extensions: ['.avi'],
    mimeType: 'video/x-msvideo',
    mediaType: 'video',
    matches: hasAviStructure,
  },
];

const ALLOWED_EXTENSIONS = new Set(MEDIA_FORMATS.flatMap((format) => format.extensions));
const INLINE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'video/mp4',
  'video/quicktime',
]);
const ALLOWED_MIME_TYPES = new Set(MEDIA_FORMATS.map((format) => format.mimeType));

const sniffMediaFormat = (filename: string, buffer: Buffer) => {
  const extension = path.extname(String(filename || '')).toLowerCase();
  return MEDIA_FORMATS.find(
    (format) => format.extensions.includes(extension) && format.matches(buffer)
  );
};

const mediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req: any, file: any, cb: any) => {
    const extension = path.extname(String(file.originalname || '')).toLowerCase();
    cb(null, ALLOWED_EXTENSIONS.has(extension));
  },
});

const safeDispositionFilename = (filename: unknown, fallback: string) =>
  Array.from(String(filename || fallback))
    .map((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127 || character === '"' || character === '\\' ? '_' : character;
    })
    .join('');

type MediaService = {
  getNetworkNoteById?: (noteId: string) => Promise<{
    id: number;
    bssid?: string;
  } | null>;
  addNoteMedia: (...args: any[]) => Promise<{
    id: number;
    note_id?: number;
    bssid?: string;
    file_name?: string;
    file_size?: number;
    media_type?: string;
    mime_type?: string;
    created_at?: string;
  }>;
};

const handleNoteMediaUpload = async (req: any, res: any, service: MediaService, logger: any) => {
  try {
    const { noteId } = req.params;
    if (!req.file) {
      return res.status(400).json({ ok: false, error: 'No file provided' });
    }
    if (!Buffer.isBuffer(req.file.buffer)) {
      return res.status(400).json({ ok: false, error: 'Invalid media payload' });
    }

    const format = sniffMediaFormat(req.file.originalname, req.file.buffer);
    if (!format) {
      return res.status(400).json({ ok: false, error: 'File type or content not allowed' });
    }

    const note = await service.getNetworkNoteById?.(noteId);
    if (!note) {
      return res.status(404).json({ ok: false, error: 'Note not found' });
    }

    const media = await service.addNoteMedia(
      noteId,
      note.bssid || 'UNKNOWN',
      req.file.originalname,
      req.file.buffer.length,
      format.mediaType,
      req.file.buffer,
      format.mimeType
    );
    res.json({
      ok: true,
      note_id: noteId,
      media_id: media.id,
      file_name: media.file_name || req.file.originalname,
      file_size: media.file_size ?? req.file.size,
      mime_type: media.mime_type || format.mimeType,
      message: 'Media uploaded',
    });
  } catch (error: any) {
    logger.error('Note media upload failed:', error);
    res.status(500).json({
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
    if (!/^\d+$/.test(filename)) {
      return res.status(404).json({ ok: false, error: 'Media not found' });
    }

    const media = await service.getNoteMediaById(filename);
    if (!media) {
      return res.status(404).json({ ok: false, error: 'Media not found' });
    }
    if (!Buffer.isBuffer(media.media_data)) {
      return res.status(404).json({ ok: false, error: 'Media payload missing' });
    }

    const mimeType = String(media.mime_type || '').toLowerCase();
    const safeMimeType = ALLOWED_MIME_TYPES.has(mimeType) ? mimeType : 'application/octet-stream';
    const inline = INLINE_MIME_TYPES.has(safeMimeType);
    const fallbackFilename = `media-${media.id}`;
    const dispositionFilename = safeDispositionFilename(media.file_name, fallbackFilename);

    res.setHeader('Content-Type', safeMimeType);
    res.setHeader(
      'Content-Disposition',
      `${inline ? 'inline' : 'attachment'}; filename="${dispositionFilename}"`
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (safeMimeType !== 'application/pdf') {
      res.setHeader('Content-Security-Policy', 'sandbox');
    }
    return res.send(media.media_data);
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
