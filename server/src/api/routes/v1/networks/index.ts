/**
 * Networks Routes - Main Router
 * Modular organization of network endpoints
 */

export {};

const express = require('express');
const router = express.Router();

// Import modular route handlers
// Some use `export default` (compiled to { default: router }), others use module.exports
const resolveDefault = (m: any) => m.default || m;
const manufacturerRoutes = resolveDefault(require('./manufacturer'));
const searchRoutes = resolveDefault(require('./search'));
const tagsRoutes = resolveDefault(require('./tags'));
const observationsRoutes = resolveDefault(require('./observations'));
const listRoutes = resolveDefault(require('./list'));

// Mount modular routes
router.use('/', manufacturerRoutes);
router.use('/', searchRoutes);
router.use('/', tagsRoutes);
router.use('/', observationsRoutes);
router.use('/', listRoutes);

module.exports = router;
