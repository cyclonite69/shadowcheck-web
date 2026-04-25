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
import observationsRoutes from './observations';
import statsRoutes from './stats';

// Mount routes
router.use('/', liveRoutes);
router.use('/', statusRoutes);
router.use('/', databaseRoutes);
router.use('/', searchRoutes);
router.use('/', detailRoutes);
router.use('/', observationsRoutes);
router.use('/', statsRoutes);

export default router;
