/**
 * Network Tags Router Index
 * Coordinates sub-routes for network tags
 */

const express = require('express');
const router = express.Router();

const listRoutes = require('./listTags');
const manageRoutes = require('./manageTags');

// Mount sub-routes
router.use('/', listRoutes);
router.use('/', manageRoutes);

module.exports = router;
