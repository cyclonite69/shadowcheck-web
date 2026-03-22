/**
 * Admin Data Maintenance Routes
 * Handles duplicate cleanup and colocation refresh
 */

const express = require('express');
const router = express.Router();
const { ROUTE_CONFIG } = require('../../../../config/routeConfig');
const { adminMaintenanceService } = require('../../../../config/container');
const logger = require('../../../../logging/logger');

export {};

router.post('/admin/cleanup-duplicates', async (req, res, next) => {
  try {
    logger.info('Removing duplicate observations...');

    const before = await adminMaintenanceService.getDuplicateObservationStats();
    const removed = await adminMaintenanceService.deleteDuplicateObservations();
    const after = await adminMaintenanceService.getObservationCount();

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

    await adminMaintenanceService.refreshColocationView(ROUTE_CONFIG.minValidTimestamp);

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
