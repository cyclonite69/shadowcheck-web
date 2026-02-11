/**
 * Explorer Routes - Main Router
 * Modular organization of explorer endpoints
 */

export {};

const express = require('express');
const router = express.Router();

// Import modular route handlers
const networksRoutes = require('./networks');

// Mount modular routes
router.use('/', networksRoutes);

module.exports = router;
