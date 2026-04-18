/**
 * Admin Routes
 * Handles administrative operations (duplicates, colocation, etc.)
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { spawn } = require('child_process');
const { adminNetworkTagsService } = require('../../../config/container');
const logger = require('../../../logging/logger');
const { validateBSSID, validateTimestamp: validateTimestampMs } = require('../../../validation/schemas');
const { requireAdmin } = require('../../../middleware/authMiddleware');
const { buildContextMenuDemoHtml } = require('../../../services/admin/adminHelpers');

export {};
const adminMlRoutes = require('./ml');
const adminTagsRoutes = require('./admin/tags');
const adminNotesRoutes = require('./admin/notes');
const adminMediaRoutes = require('./admin/media');
const adminOuiRoutes = require('./admin/oui');
const adminBackupRoutes = require('./admin/backup');
const adminPgAdminRoutes = require('./admin/pgadmin');
const adminSettingsRoutes = require('./admin/settings');
const adminUsersRoutes = require('./admin/users');
const adminGeocodingRoutes = require('./admin/geocoding');
const adminAwsRoutes = require('./admin/aws');
const adminAwsInstancesRoutes = require('./admin/awsInstances').default;
const adminSecretsRoutes = require('./admin/secrets');
const adminImportRoutes = require('./admin/import');
const adminMaintenanceRoutes = require('./admin/maintenance');
const adminSiblingsRoutes = require('./admin/siblings');
const adminDataQualityRoutes = require('./dataQuality').default;
const adminDbStatsRoutes = require('./admin/dbStats').default;

// Protect all admin routes
router.use(requireAdmin);

// Configure multer for SQLite file uploads
const upload = multer({
  dest: '/tmp/',
  fileFilter: (req: any, file: any, cb: any) => {
    const allowedExts = ['.sqlite', '.db', '.sqlite3'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only SQLite files (.sqlite, .db, .sqlite3) are allowed'));
    }
  },
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB limit
  },
});

router.use(adminMlRoutes);
router.use(adminTagsRoutes);
router.use(adminNotesRoutes);
router.use(adminMediaRoutes);
router.use(adminOuiRoutes);
router.use(adminBackupRoutes);
router.use(adminPgAdminRoutes);
router.use('/admin/settings', adminSettingsRoutes);
router.use('/admin/users', adminUsersRoutes);
router.use(adminGeocodingRoutes);
router.use(adminSecretsRoutes);
router.use(adminAwsRoutes);
router.use('/admin/aws', adminAwsInstancesRoutes);
router.use(adminImportRoutes);
router.use(adminMaintenanceRoutes);
router.use(adminSiblingsRoutes);
router.use('/admin/data-quality', adminDataQualityRoutes);
router.use('/admin/db-stats', adminDbStatsRoutes);

// GET /api/observations/check-duplicates/:bssid - Check for duplicate observations
router.get('/observations/check-duplicates/:bssid', async (req: any, res: any, next: any) => {
  try {
    const { bssid } = req.params;
    const { time } = req.query;

    const bssidValidation = validateBSSID(bssid);
    if (!bssidValidation.valid) {
      return res.status(400).json({ error: bssidValidation.error });
    }

    if (time === undefined || time === null || time === '') {
      return res.status(400).json({ error: 'time parameter required (milliseconds)' });
    }

    const timeValidation = validateTimestampMs(time);
    if (!timeValidation.valid) {
      return res.status(400).json({ error: timeValidation.error });
    }

    const data = await adminNetworkTagsService.checkDuplicateObservations(
      bssidValidation.cleaned,
      timeValidation.value
    );

    res.json({
      ok: true,
      data,
      isSuspicious: data && data.total_observations >= 10,
    });
  } catch (err: any) {
    next(err);
  }
});

// TEST endpoint to verify admin routes work
router.get('/admin/test', async (req: any, res: any) => {
  res.json({ message: 'Admin routes are working!' });
});

// Simple test route to verify new routes work
router.get('/admin/simple-test', (req: any, res: any) => {
  res.json({ ok: true, message: 'Simple test route working' });
});

// Test notes route
router.get('/admin/notes-test', (req: any, res: any) => {
  res.json({ ok: true, message: 'Notes route working' });
});

// Add note endpoint
router.post('/admin/add-note', async (req: any, res: any) => {
  try {
    const { bssid, content } = req.body;
    const note_id = await adminNetworkTagsService.addNetworkNote(bssid, content);
    res.json({ ok: true, note_id });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// Simple test route to verify new routes work
// GET /api/admin/network-summary/:bssid - Get complete network summary
router.get('/admin/network-summary/:bssid', async (req: any, res: any, next: any) => {
  try {
    const { bssid } = req.params;

    const network = await adminNetworkTagsService.getNetworkSummary(bssid);

    if (!network) {
      return res.status(404).json({
        error: { message: `No data found for network ${bssid}` },
      });
    }

    res.json({
      ok: true,
      network,
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * GET /api/demo/context-menu - Serve context menu demo
 */
router.get('/demo/context-menu', (_req: any, res: any) => {
  res.send(buildContextMenuDemoHtml());
});

module.exports = router;
