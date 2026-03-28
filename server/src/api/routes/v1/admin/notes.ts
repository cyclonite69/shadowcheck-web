/**
 * Admin Network Notes Routes
 * Notes and notations management for networks
 */

export {};

const express = require('express');
const router = express.Router();
const { adminNetworkMediaService } = require('../../../../config/container');
const logger = require('../../../../logging/logger');
const { mediaUpload, handleNoteMediaUpload, serveNoteMedia } = require('./adminNotesHelpers');

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
  async (req: any, res: any) => handleNoteMediaUpload(req, res, adminNetworkMediaService, logger)
);

// GET /api/media/:filename
router.get('/media/:filename', (req: any, res: any) =>
  serveNoteMedia(req, res, adminNetworkMediaService, logger)
);

module.exports = router;
