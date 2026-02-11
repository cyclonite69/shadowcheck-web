/**
 * Networks Routes - Modular Index
 *
 * All routes moved to networks/ subdirectory:
 * - networks/index.ts: Main router coordinating all sub-routes
 * - networks/list.ts: GET /networks listing endpoint
 * - networks/search.ts: GET /networks/search
 * - networks/tags.ts: POST/PUT/DELETE /networks/tags
 * - networks/observations.ts: GET /networks/observations
 * - networks/manufacturer.ts: GET /networks/manufacturer
 * - networks/home-location.ts: GET /networks/home-location
 */

module.exports = require('./networks/index');
