export {};
const express = require('express');
const router = express.Router();
const { query } = require('../../../config/database');
const { adminQuery } = require('../../../services/adminDbService');
const secretsManager = require('../../../services/secretsManager');
const { requireAdmin } = require('../../../middleware/authMiddleware');
const { validateString } = require('../../../validation/schemas');

/**
 * Normalizes API key input from headers or query params.
 * @param {any} value - Raw API key value
 * @returns {string|null} Normalized API key or null
 */
function normalizeApiKey(value) {
  if (value === undefined || value === null) {
    return null;
  }
  const validation = validateString(String(value), 1, 256, 'api_key');
  if (!validation.valid) {
    return null;
  }
  return String(value).trim();
}

/**
 * Requires API key authentication for backup routes.
 * @param {object} req - Express request
 * @param {object} res - Express response
 * @param {function} next - Express next handler
 */
const requireAuth = (req, res, next) => {
  const apiKey = normalizeApiKey(req.headers['x-api-key'] || req.query.api_key);
  const validKey = secretsManager.get('api_key');
  if (!validKey || !apiKey || apiKey !== validKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// Backup database as JSON (simpler than pg_dump version issues)
router.get('/backup', requireAuth, requireAdmin, async (req, res) => {
  try {
    const timestamp = Date.now();
    const filename = `shadowcheck_backup_${timestamp}.json`;

    // Export all data
    const [observations, networks, tags] = await Promise.all([
      query('SELECT * FROM app.observations ORDER BY observed_at DESC'),
      query('SELECT * FROM app.networks'),
      query('SELECT * FROM app.network_tags'),
    ]);

    const backup = {
      exported_at: new Date().toISOString(),
      version: '1.0',
      database: process.env.DB_NAME,
      tables: {
        observations: observations.rows,
        networks: networks.rows,
        network_tags: tags.rows,
      },
      counts: {
        observations: observations.rows.length,
        networks: networks.rows.length,
        network_tags: tags.rows.length,
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
router.post('/restore', requireAuth, requireAdmin, async (req, res) => {
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
