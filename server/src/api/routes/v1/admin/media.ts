/**
 * Admin Network Media Routes
 * Media upload and management for networks
 */

export {};

const express = require('express');
const router = express.Router();
const { adminNetworkMediaService } = require('../../../../config/container');
const logger = require('../../../../logging/logger');

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

module.exports = router;
