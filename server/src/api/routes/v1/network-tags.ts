/**
 * Network Tags Routes (v1)
 *
 * Routes moved to modular structure:
 * - network-tags/listTags.ts: GET endpoints
 * - network-tags/manageTags.ts: POST/PATCH/DELETE endpoints
 * - network-tags/index.ts: router coordination
 */

// Legacy: Routes moved to modular structure
// See: server/src/api/routes/v1/network-tags/

module.exports = require('./network-tags/index');
