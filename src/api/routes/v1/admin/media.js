/**
 * Admin Network Media Routes
 * Media upload and management for networks
 */

const express = require('express');
const router = express.Router();
const { query } = require('../../../../config/database');
const logger = require('../../../../logging/logger');

// POST /api/admin/network-media/upload - Upload media (image/video) to network
router.post('/admin/network-media/upload', async (req, res, next) => {
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
    const result = await query(
      `
      INSERT INTO app.network_media
        (bssid, media_type, filename, file_size, mime_type, media_data, description, uploaded_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'admin')
      RETURNING id, filename, file_size, created_at
    `,
      [bssid, media_type, filename, fileSize, mime_type, mediaBuffer, description]
    );

    res.json({
      ok: true,
      message: `${media_type} uploaded successfully`,
      media: result.rows[0],
    });
  } catch (error) {
    logger.error(`Upload media error: ${error.message}`);
    next(error);
  }
});

// GET /api/admin/network-media/:bssid - Get media list for network
router.get('/admin/network-media/:bssid', async (req, res, next) => {
  try {
    const { bssid } = req.params;

    const result = await query(
      `
      SELECT id, media_type, filename, original_filename, file_size,
             mime_type, description, uploaded_by, created_at
      FROM app.network_media
      WHERE bssid = $1
      ORDER BY created_at DESC
    `,
      [bssid]
    );

    res.json({
      ok: true,
      bssid,
      media: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/network-media/download/:id - Download media file
router.get('/admin/network-media/download/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await query(
      'SELECT filename, mime_type, media_data FROM app.network_media WHERE id = $1',
      [id]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        error: { message: 'Media not found' },
      });
    }

    const media = result.rows[0];

    res.set({
      'Content-Type': media.mime_type || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${media.filename}"`,
    });

    res.send(media.media_data);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
