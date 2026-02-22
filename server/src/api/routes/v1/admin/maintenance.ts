/**
 * Admin Data Maintenance Routes
 * Handles duplicate cleanup and colocation refresh
 */

const express = require('express');
const router = express.Router();
const { CONFIG } = require('../../../../config/database');
const { adminDbService } = require('../../../../config/container');
const logger = require('../../../../logging/logger');

export {};

router.post('/admin/cleanup-duplicates', async (req, res, next) => {
  try {
    logger.info('Removing duplicate observations...');

    const before = await adminDbService.getDuplicateObservationStats();
    const removed = await adminDbService.deleteDuplicateObservations();
    const after = await adminDbService.getObservationCount();

    logger.info(`Removed ${removed} duplicate observations`);

    res.json({
      ok: true,
      message: 'Duplicate observations removed',
      before: before.total,
      after,
      removed,
    });
  } catch (err) {
    logger.error(`Error removing duplicates: ${err.message}`, { error: err });
    next(err);
  }
});

router.post('/admin/refresh-colocation', async (req, res, next) => {
  try {
    logger.info('Creating/refreshing co-location materialized view...');

    await adminDbService.refreshColocationView(CONFIG.MIN_VALID_TIMESTAMP);

    logger.info('Co-location view created successfully');

    res.json({
      ok: true,
      message: 'Co-location materialized view created/refreshed successfully',
    });
  } catch (err) {
    logger.error(`Error creating co-location view: ${err.message}`, { error: err });
    next(err);
  }
});

module.exports = router;
