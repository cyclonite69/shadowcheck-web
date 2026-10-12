/**
 * WiGLE Routes - Main Router
 * Modular organization of WiGLE integration endpoints
 */

import express from 'express';
const router = express.Router();

// Import modular route handlers
import liveRoutes from './live';
import statusRoutes from './status';
import databaseRoutes from './database';
import searchRoutes from './search';
import detailRoutes from './detail';
import enrichmentRoutes from './enrichment';
import observationsRoutes from './observations';
import statsRoutes from './stats';
import ledgerRoutes from './ledger';
import tileRoutes from './tiles';

// Mount routes
router.use('/', liveRoutes);
router.use('/', statusRoutes);
router.use('/', databaseRoutes);
router.use('/', searchRoutes);
router.use('/', detailRoutes);
router.use('/', enrichmentRoutes);
router.use('/', observationsRoutes);
router.use('/', statsRoutes);
router.use('/', ledgerRoutes);
router.use('/', tileRoutes);

export default router;
