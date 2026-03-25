/**
 * Admin Network Notes Routes
 * Notes and notations management for networks
 */

export {};

const express = require('express');
const router = express.Router();
const path = require('path');
const { adminNetworkMediaService } = require('../../../../config/container');
const logger = require('../../../../logging/logger');

// Configure multer for media uploads (notes attachments)
const multer = require('multer');
const fs = require('fs');

const mediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req: any, file: any, cb: any) => {
    const allowed = /\.(jpg|jpeg|png|gif|pdf|mp4|mov|avi)$/i;
    if (allowed.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed'));
    }
  },
});

// POST /api/admin/network-notations/add - Add notation to network
router.post('/admin/network-notations/add', async (req: any, res: any, next: any) => {
  try {
    const { bssid, text, type = 'general' } = req.body;

    if (!bssid || !text) {
      return res.status(400).json({
        error: { message: 'BSSID and text are required' },
      });
    }

    const validTypes = ['general', 'observation', 'technical', 'location', 'behavior'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        error: { message: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
      });
    }

    // Add notation
    const notation = await adminNetworkMediaService.addNetworkNotation(bssid, text, type);

    res.json({
      ok: true,
      message: 'Notation added successfully',
      notation,
    });
  } catch (error: any) {
    logger.error(`Add notation error: ${error.message}`);
    next(error);
  }
});

// GET /api/admin/network-notations/:bssid - Get all notations for network
router.get('/admin/network-notations/:bssid', async (req: any, res: any, next: any) => {
  try {
    const { bssid } = req.params;

    const notations = await adminNetworkMediaService.getNetworkNotations(bssid);

    res.json({
      ok: true,
      bssid,
      notations,
      count: notations.length,
    });
  } catch (error: any) {
    next(error);
  }
});

// POST /api/admin/network-notes/add - Add note to network (right-click context menu)
router.post('/admin/network-notes/add', async (req: any, res: any) => {
  try {
    const { bssid, content, note_type = 'general', user_id = 'default_user' } = req.body;

    if (!bssid || !content) {
      return res.status(400).json({
        ok: false,
        error: 'BSSID and content are required',
      });
    }

    const note_id = await adminNetworkMediaService.addNetworkNoteWithFunction(
      bssid,
      content,
      note_type,
      user_id
    );

    res.json({
      ok: true,
      bssid,
      note_id,
      message: 'Note added successfully',
    });
  } catch (error: any) {
    logger.error('Add note failed:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to add note',
      details: error.message,
    });
  }
});

// GET /api/admin/network-notes/:bssid - Get all notes for a network
router.get('/admin/network-notes/:bssid', async (req: any, res: any) => {
  try {
    const { bssid } = req.params;

    const notes = await adminNetworkMediaService.getNetworkNotes(bssid);

    res.json({
      ok: true,
      bssid,
      notes,
      count: notes.length,
    });
  } catch (error: any) {
    logger.error('Get notes failed:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to get notes',
      details: error.message,
    });
  }
});

// DELETE /api/admin/network-notes/:noteId
router.delete('/admin/network-notes/:noteId', async (req: any, res: any) => {
  try {
    const { noteId } = req.params;
    const bssid = await adminNetworkMediaService.deleteNetworkNote(noteId);
    if (!bssid) {
      return res.status(404).json({ ok: false, error: 'Note not found' });
    }
    res.json({ ok: true, note_id: noteId, bssid, message: 'Note deleted' });
  } catch (error: any) {
    logger.error('Delete note failed:', error);
    res.status(500).json({ ok: false, error: 'Failed to delete note' });
  }
});

// POST /api/admin/network-notes/:noteId/media
router.post(
  '/admin/network-notes/:noteId/media',
  mediaUpload.single('file'),
  async (req: any, res: any) => {
    try {
      const { noteId } = req.params;
      const { bssid } = req.body;
      if (!req.file) {
        return res.status(400).json({ ok: false, error: 'No file provided' });
      }
      const inferredMediaType = req.file.mimetype?.startsWith('video/')
        ? 'video'
        : req.file.mimetype === 'application/pdf'
          ? 'document'
          : 'image';
      const media = await adminNetworkMediaService.addNoteMedia(
        noteId,
        bssid,
        null,
        req.file.originalname,
        req.file.size,
        inferredMediaType,
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
    } catch (error: any) {
      logger.error('Media upload failed:', error);
      res.status(500).json({ ok: false, error: 'Failed to upload media' });
    }
  }
);

// GET /api/media/:filename
router.get('/media/:filename', (req: any, res: any) => {
  try {
    const { filename } = req.params;
    const isNumericId = /^\d+$/.test(filename);
    if (isNumericId) {
      return adminNetworkMediaService
        .getNoteMediaById(filename)
        .then((media: any) => {
          if (!media) {
            return res.status(404).json({ ok: false, error: 'Media not found' });
          }
          if (media.media_data) {
            res.setHeader('Content-Type', media.mime_type || 'application/octet-stream');
            res.setHeader(
              'Content-Disposition',
              `inline; filename=\"${media.file_name || `media-${media.id}`}\"`
            );
            return res.send(media.media_data);
          }
          if (media.file_path) {
            const localName = String(media.file_path).replace('/api/media/', '');
            const filepath = path.join(__dirname, '../../../../data/notes-media', localName);
            return res.sendFile(filepath);
          }
          return res.status(404).json({ ok: false, error: 'Media payload missing' });
        })
        .catch((error: any) => {
          logger.error('Media serve failed:', error);
          return res.status(500).json({ ok: false, error: 'Failed to serve media' });
        });
    }

    // Legacy filename fallback for older links
    if (filename.includes('..')) {
      return res.status(403).json({ ok: false, error: 'Access denied' });
    }
    const filepath = path.join(__dirname, '../../../../data/notes-media', filename);
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ ok: false, error: 'Media not found' });
    }
    return res.sendFile(filepath);
  } catch (error: any) {
    logger.error('Media serve failed:', error);
    return res.status(500).json({ ok: false, error: 'Failed to serve media' });
  }
});

module.exports = router;
