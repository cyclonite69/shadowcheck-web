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
router.use('/wigle', liveRoutes);
router.use('/wigle', statusRoutes);
router.use('/wigle', databaseRoutes);
router.use('/wigle', searchRoutes);
router.use('/wigle', detailRoutes);
router.use('/wigle', observationsRoutes);
router.use('/wigle', statsRoutes);

export default router;
