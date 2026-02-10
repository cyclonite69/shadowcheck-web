/**
 * Networks Routes - Main Router
 * Modular organization of network endpoints
 */

import express from 'express';
const router = express.Router();

// Import modular route handlers
import manufacturerRoutes from './manufacturer';
import homeLocationRoutes from './home-location';
import searchRoutes from './search';
import tagsRoutes from './tags';
import observationsRoutes from './observations';

// Mount routes
router.use('/', manufacturerRoutes);
router.use('/', homeLocationRoutes);
router.use('/', searchRoutes);
router.use('/', tagsRoutes);
router.use('/', observationsRoutes);

export default router;
