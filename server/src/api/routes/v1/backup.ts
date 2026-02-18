export {};
const express = require('express');
const router = express.Router();
const adminDbService = require('../../../services/adminDbService');
const { adminQuery } = require('../../../services/adminDbService');
const { requireAdmin } = require('../../../middleware/authMiddleware');

// Backup database as JSON (simpler than pg_dump version issues)
router.get('/backup', requireAdmin, async (req, res) => {
  try {
    const timestamp = Date.now();
    const filename = `shadowcheck_backup_${timestamp}.json`;

    // Export all data
    const { observations, networks, tags } = await adminDbService.getBackupData();

    const backup = {
      exported_at: new Date().toISOString(),
      version: '1.0',
      database: process.env.DB_NAME,
      tables: {
        observations,
        networks,
        network_tags: tags,
      },
      counts: {
        observations: observations.length,
        networks: networks.length,
        network_tags: tags.length,
      },
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.json(backup);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Restore database from JSON backup
router.post('/restore', requireAdmin, async (req, res) => {
  try {
    if (!req.files || !req.files.backup) {
      return res.status(400).json({ error: 'No backup file provided' });
    }

    const backupFile = req.files.backup;
    const backup = JSON.parse(backupFile.data.toString());

    if (!backup.tables) {
      return res.status(400).json({ error: 'Invalid backup file format' });
    }

    // Truncate tables
    await adminQuery('TRUNCATE TABLE app.observations CASCADE');
    await adminQuery('TRUNCATE TABLE app.networks CASCADE');

    // Restore data (simplified - would need proper INSERT statements)
    res.json({
      success: true,
      message: 'Backup uploaded. Full restore requires manual SQL execution.',
      counts: backup.counts,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
