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

// Mount routes
router.use('/wigle', liveRoutes);
router.use('/wigle', statusRoutes);
router.use('/wigle', databaseRoutes);

// Fallback to monolithic routes for endpoints not yet extracted
const legacyRoutes = require('./routes');
router.use('/', legacyRoutes);

export default router;
