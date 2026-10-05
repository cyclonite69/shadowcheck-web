/**
 * Admin Network Media Routes
 * Media upload and management for networks
 */

export {};

const express = require('express');
const router = express.Router();
const { adminNetworkMediaService } = require('../../../../config/container');
const logger = require('../../../../logging/logger');
const { parseByteRange } = require('../../../../utils/httpRangeUtils');

// POST /api/admin/network-media/upload - Upload media (image/video) to network
router.post('/admin/network-media/upload', async (req: any, res: any, next: any) => {
  try {
    const { bssid, media_type, filename, media_data_base64, description, mime_type } = req.body;

    if (!bssid || !media_type || !filename || !media_data_base64) {
      return res.status(400).json({
        error: { message: 'BSSID, media_type, filename, and media_data_base64 are required' },
      });
    }

    if (!['image', 'video'].includes(media_type)) {
      return res.status(400).json({
        error: { message: 'media_type must be "image" or "video"' },
      });
    }

    // Decode base64 and get file size
    const mediaBuffer = Buffer.from(media_data_base64, 'base64');
    const fileSize = mediaBuffer.length;

    // Insert media
    const media = await adminNetworkMediaService.uploadNetworkMedia(
      bssid,
      media_type,
      filename,
      fileSize,
      mime_type,
      mediaBuffer,
      description
    );

    res.json({
      ok: true,
      message: `${media_type} uploaded successfully`,
      media,
    });
  } catch (error: any) {
    if (error.code === 'VISINT_DUPLICATE_MEDIA') {
      return res.status(409).json({
        error: {
          message: error.message,
          code: 'VISINT_DUPLICATE_MEDIA',
          existingId: error.existingId,
        },
      });
    }
    logger.error(`Upload media error: ${error.message}`);
    next(error);
  }
});

// GET /api/admin/network-media/:bssid - Get media list for network
router.get('/admin/network-media/:bssid', async (req: any, res: any, next: any) => {
  try {
    const { bssid } = req.params;

    const media = await adminNetworkMediaService.getNetworkMediaList(bssid);

    res.json({
      ok: true,
      bssid,
      media,
      count: media.length,
    });
  } catch (error: any) {
    next(error);
  }
});

// GET /api/admin/network-media/download/:id - Download media file
router.get('/admin/network-media/download/:id', async (req: any, res: any, next: any) => {
  try {
    const { id } = req.params;

    const media = await adminNetworkMediaService.getNetworkMediaFile(id);

    if (!media) {
      return res.status(404).json({
        error: { message: 'Media not found' },
      });
    }

    res.set({
      'Content-Type': media.mime_type || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${media.filename}"`,
    });

    res.send(media.media_data);
  } catch (error: any) {
    next(error);
  }
});

/**
 * Serve network media file inline for rendering (optionally fetching a thumbnail).
 *
 * For full video media (media_type === 'video' or mime_type starting with 'video/'),
 * supports single HTTP byte-range requests (RFC 9110) returning HTTP 206 Partial Content
 * or HTTP 416 Range Not Satisfiable.
 *
 * NOTE: This delivers HTTP byte-range slices over an in-memory Buffer retrieved from
 * PostgreSQL bytea storage, enabling browser streaming and seeking without altering
 * the underlying database storage layer.
 *
 * GET /api/admin/network-media/:id/inline
 *
 * @param {string} req.params.id Media record ID
 * @param {string} [req.query.thumbnail] Set to 'true' to request thumbnail fallback
 */
router.get('/admin/network-media/:id/inline', async (req: any, res: any, next: any) => {
  try {
    const { id } = req.params;
    const thumbnailRequested = req.query.thumbnail === 'true';

    const media = await adminNetworkMediaService.getNetworkMediaFile(id);

    if (!media || (!media.media_data && !media.thumbnail)) {
      return res.status(404).json({
        error: { message: 'Media not found' },
      });
    }

    // Determine whether to serve thumbnail (if requested and present) or full media
    const serveThumbnail = thumbnailRequested && media.thumbnail;
    const buffer: Buffer | null = serveThumbnail ? media.thumbnail : media.media_data;

    if (!buffer) {
      return res.status(404).json({
        error: { message: 'Media not found' },
      });
    }

    const isVideo =
      !serveThumbnail &&
      (media.media_type === 'video' ||
        (typeof media.mime_type === 'string' && media.mime_type.startsWith('video/')));
    const mimeType = media.mime_type || (isVideo ? 'video/mp4' : 'image/jpeg');
    const totalSize = buffer.length;

    res.set({
      'Content-Disposition': 'inline',
    });

    if (isVideo) {
      res.set('Accept-Ranges', 'bytes');

      const rangeHeader = req.headers.range;
      const parsed = parseByteRange(rangeHeader, totalSize);

      if (parsed.status === 'unsatisfiable') {
        res.set('Content-Range', `bytes */${totalSize}`);
        return res.status(416).end();
      }

      if (parsed.status === 'range' && parsed.start !== undefined && parsed.end !== undefined) {
        const { start, end } = parsed;
        const chunkSize = end - start + 1;

        res.status(206);
        res.set({
          'Content-Range': `bytes ${start}-${end}/${totalSize}`,
          'Content-Length': String(chunkSize),
          'Content-Type': mimeType,
        });

        return res.send(buffer.subarray(start, end + 1));
      }
    }

    // Standard response: images, thumbnails, full video downloads, or when Range is absent/ignored
    res.set({
      'Content-Type': mimeType,
      'Content-Length': String(totalSize),
    });

    res.send(buffer);
  } catch (error: any) {
    next(error);
  }
});

// DELETE /api/admin/network-media/media/:id - Delete media file
router.delete('/admin/network-media/media/:id', async (req: any, res: any, next: any) => {
  try {
    const { id } = req.params;
    const deleted = await adminNetworkMediaService.deleteNetworkMedia(id);

    if (!deleted) {
      return res.status(404).json({
        error: { message: 'Media not found' },
      });
    }

    res.json({
      ok: true,
      message: 'Media deleted successfully',
      deleted,
    });
  } catch (error: any) {
    next(error);
  }
});

// GET /api/admin/network-media-duplicates - Get duplicate media groups
router.get('/admin/network-media-duplicates', async (req: any, res: any, next: any) => {
  try {
    const duplicates = await adminNetworkMediaService.getDuplicateMediaGroups();
    res.json({
      ok: true,
      duplicates,
      count: duplicates.length,
    });
  } catch (error: any) {
    next(error);
  }
});

module.exports = router;
