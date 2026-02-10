/**
 * Explorer Routes - Main Router
 * Modular organization of explorer endpoints
 */

import express from 'express';
const router = express.Router();

// Load from parent explorer.ts for now
const explorerRoutes = require('../explorer');
router.use('/', explorerRoutes);

export default router;
