const express = require('express');
const router = express.Router();
const { threatScoringService } = require('../../../config/container');
const logger = require('../../logging/logger');

export {};

// POST /api/admin/threat-scoring/compute - Manual threat score computation
router.post('/threat-scoring/compute', async (req, res) => {
  try {
    const { batchSize = 1000, maxAgeHours = 24 } = req.body;

    const result = await threatScoringService.computeThreatScores(batchSize, maxAgeHours);

    res.json({
      success: true,
      message: 'Threat score computation completed',
      ...result,
    });
  } catch (error) {
    logger.error('Manual threat scoring failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// POST /api/admin/threat-scoring/recompute-all - Mark all for recomputation
router.post('/threat-scoring/recompute-all', async (req, res) => {
  try {
    const result = await threatScoringService.markAllForRecompute();

    res.json({
      success: true,
      message: 'All networks marked for threat recomputation',
      ...result,
    });
  } catch (error) {
    logger.error('Failed to mark all for recomputation', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// GET /api/admin/threat-scoring/stats - Get threat scoring statistics
router.get('/threat-scoring/stats', (req, res) => {
  try {
    const stats = threatScoringService.getStats();

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    logger.error('Failed to get threat scoring stats', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
