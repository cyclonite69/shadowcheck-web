/**
 * Admin Network Notes Routes
 * Notes and notations management for networks
 */

export {};

const express = require('express');
const router = express.Router();
const path = require('path');
const { query } = require('../../../../config/database');
const { adminQuery } = require('../../../../services/adminDbService');
const logger = require('../../../../logging/logger');

// Configure multer for media uploads (notes attachments)
const multer = require('multer');
const fs = require('fs').promises;

const mediaStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../../../data/notes-media');
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const bssid = req.body.bssid || 'unknown';
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    cb(null, `${bssid}-${timestamp}${ext}`);
  },
});

const mediaUpload = multer({
  storage: mediaStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|gif|pdf|mp4|mov|avi)$/i;
    if (allowed.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed'));
    }
  },
});

// POST /api/admin/network-notations/add - Add notation to network
router.post('/admin/network-notations/add', async (req, res, next) => {
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
    const result = await adminQuery('SELECT app.network_add_notation($1, $2, $3) as notation', [
      bssid,
      text,
      type,
    ]);

    res.json({
      ok: true,
      message: 'Notation added successfully',
      notation: result.rows[0].notation,
    });
  } catch (error) {
    logger.error(`Add notation error: ${error.message}`);
    next(error);
  }
});

// GET /api/admin/network-notations/:bssid - Get all notations for network
router.get('/admin/network-notations/:bssid', async (req, res, next) => {
  try {
    const { bssid } = req.params;

    const result = await query('SELECT detailed_notes FROM app.network_tags WHERE bssid = $1', [
      bssid,
    ]);

    const notations = result.rows.length > 0 ? result.rows[0].detailed_notes || [] : [];

    res.json({
      ok: true,
      bssid,
      notations,
      count: notations.length,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/network-notes/add - Add note to network (right-click context menu)
router.post('/admin/network-notes/add', async (req, res) => {
  try {
    const { bssid, content, note_type = 'general', user_id = 'default_user' } = req.body;

    if (!bssid || !content) {
      return res.status(400).json({
        ok: false,
        error: 'BSSID and content are required',
      });
    }

    const result = await adminQuery('SELECT app.network_add_note($1, $2, $3, $4) as note_id', [
      bssid,
      content,
      note_type,
      user_id,
    ]);

    res.json({
      ok: true,
      bssid,
      note_id: result.rows[0].note_id,
      message: 'Note added successfully',
    });
  } catch (error) {
    logger.error('Add note failed:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to add note',
      details: error.message,
    });
  }
});

// GET /api/admin/network-notes/:bssid - Get all notes for a network
router.get('/admin/network-notes/:bssid', async (req, res) => {
  try {
    const { bssid } = req.params;

    const result = await query(
      `
      SELECT id, content, note_type, user_id, created_at, updated_at
      FROM app.network_notes
      WHERE bssid = $1
      ORDER BY created_at DESC
    `,
      [bssid]
    );

    res.json({
      ok: true,
      bssid,
      notes: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    logger.error('Get notes failed:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to get notes',
      details: error.message,
    });
  }
});

// DELETE /api/admin/network-notes/:noteId
router.delete('/admin/network-notes/:noteId', async (req, res) => {
  try {
    const { noteId } = req.params;
    const result = await adminQuery('DELETE FROM app.network_notes WHERE id = $1 RETURNING bssid', [
      noteId,
    ]);
    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Note not found' });
    }
    res.json({ ok: true, note_id: noteId, bssid: result.rows[0].bssid, message: 'Note deleted' });
  } catch (error) {
    logger.error('Delete note failed:', error);
    res.status(500).json({ ok: false, error: 'Failed to delete note' });
  }
});

// POST /api/admin/network-notes/:noteId/media
router.post('/admin/network-notes/:noteId/media', mediaUpload.single('file'), async (req, res) => {
  try {
    const { noteId } = req.params;
    const { bssid } = req.body;
    if (!req.file) {
      return res.status(400).json({ ok: false, error: 'No file provided' });
    }
    const result = await adminQuery(
      `
      INSERT INTO app.note_media (note_id, bssid, file_path, file_name, file_size, media_type)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, file_path
    `,
      [
        noteId,
        bssid,
        `/api/media/${req.file.filename}`,
        req.file.originalname,
        req.file.size,
        req.file.mimetype,
      ]
    );
    res.json({
      ok: true,
      note_id: noteId,
      media_id: result.rows[0].id,
      file_path: result.rows[0].file_path,
      message: 'Media uploaded',
    });
  } catch (error) {
    logger.error('Media upload failed:', error);
    res.status(500).json({ ok: false, error: 'Failed to upload media' });
  }
});

// GET /api/media/:filename
router.get('/media/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    const filepath = path.join(__dirname, '../../../../data/notes-media', filename);
    const normalized = path.normalize(filepath);
    const baseDir = path.normalize(path.join(__dirname, '../../../../data/notes-media'));

    if (!normalized.startsWith(baseDir)) {
      return res.status(403).json({ ok: false, error: 'Access denied' });
    }

    if (filename.includes('..')) {
      return res.status(403).json({ ok: false, error: 'Access denied' });
    }
    res.sendFile(filepath);
  } catch (error) {
    logger.error('Media serve failed:', error);
    res.status(500).json({ ok: false, error: 'Failed to serve media' });
  }
});

module.exports = router;
