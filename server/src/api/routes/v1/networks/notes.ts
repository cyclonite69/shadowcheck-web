/**
 * Network Notes Routes
 * GET / POST / PATCH / DELETE for per-network notes.
 *
 * Mounted at /api via the networks index, so paths resolve to:
 *   GET    /api/networks/:bssid/notes
 *   POST   /api/networks/:bssid/notes
 *   PATCH  /api/networks/:bssid/notes/:noteId
 *   DELETE /api/networks/:bssid/notes/:noteId
 */

export {};

const express = require('express');
const router = express.Router();
const { adminNetworkMediaService } = require('../../../../config/container');
const logger = require('../../../../logging/logger');
const { requireAdmin } = require('../../../../middleware/authMiddleware');
const { bssidParamMiddleware } = require('../../../../validation/middleware');

router.use('/networks/:bssid', bssidParamMiddleware);

/**
 * GET /api/networks/:bssid/notes
 * Return all active (non-deleted) notes for a BSSID.
 */
router.get('/networks/:bssid/notes', async (req: any, res: any) => {
  try {
    const normalizedBssid = req.params.bssid.toUpperCase();
    const notes = await adminNetworkMediaService.getNetworkNotes(normalizedBssid);
    res.json({ ok: true, bssid: normalizedBssid, notes, count: notes.length });
  } catch (error: any) {
    logger.error(`Error fetching notes: ${error.message}`, { error, bssid: req.params.bssid });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/networks/:bssid/notes
 * Create a new note. Requires admin.
 * Body: { content: string }
 */
router.post('/networks/:bssid/notes', requireAdmin, async (req: any, res: any) => {
  try {
    const normalizedBssid = req.params.bssid.toUpperCase();
    const { content } = req.body;

    if (!content || !String(content).trim()) {
      return res.status(400).json({ error: 'content is required' });
    }

    const noteId = await adminNetworkMediaService.addNetworkNoteWithFunction(
      normalizedBssid,
      String(content).trim(),
      'general',
      'system'
    );

    res.status(201).json({ ok: true, id: noteId, bssid: normalizedBssid });
  } catch (error: any) {
    logger.error(`Error creating note: ${error.message}`, { error, bssid: req.params.bssid });
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /api/networks/:bssid/notes/:noteId
 * Update note content. Requires admin.
 * Body: { content: string }
 */
router.patch('/networks/:bssid/notes/:noteId', requireAdmin, async (req: any, res: any) => {
  try {
    const { noteId } = req.params;
    const { content } = req.body;

    if (!content || !String(content).trim()) {
      return res.status(400).json({ error: 'content is required' });
    }

    const updated = await adminNetworkMediaService.updateNetworkNote(
      noteId,
      String(content).trim()
    );
    if (!updated) {
      return res.status(404).json({ error: 'Note not found or already deleted' });
    }

    res.json({ ok: true, ...updated });
  } catch (error: any) {
    logger.error(`Error updating note: ${error.message}`, { error });
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/networks/:bssid/notes/:noteId
 * Soft-delete a note (sets is_deleted = true). Requires admin.
 */
router.delete('/networks/:bssid/notes/:noteId', requireAdmin, async (req: any, res: any) => {
  try {
    const { noteId } = req.params;
    const bssid = await adminNetworkMediaService.deleteNetworkNote(noteId);

    if (!bssid) {
      return res.status(404).json({ error: 'Note not found' });
    }

    res.json({ ok: true, deleted: true, note_id: noteId, bssid });
  } catch (error: any) {
    logger.error(`Error deleting note: ${error.message}`, { error });
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
