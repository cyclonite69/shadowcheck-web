/**
 * Explorer Routes - Modular Index
 *
 * All routes moved to explorer/ subdirectory:
 * - explorer/index.ts: Main router coordinating all sub-routes
 * - explorer/networks.ts: GET /explorer/networks & /explorer/networks-v2
 * - explorer/shared.ts: Shared utilities
 */

module.exports = require('./explorer/index');
