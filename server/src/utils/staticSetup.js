/**
 * Static asset helpers.
 */

/**
 * Mount static assets from the provided path.
 * @param {import('express').Express} app - Express app instance
 * @param {string} distPath - Path to built frontend assets
 */
function mountStaticAssets(app, distPath) {
  const { mountStaticAssets: mountAssets } = require('../middleware/staticAssets');
  mountAssets(app, distPath);
}

/**
 * Register SPA fallback handler.
 * @param {import('express').Express} app - Express app instance
 * @param {string} distPath - Path to built frontend assets
 */
function registerSpaFallback(app, distPath) {
  const { createSpaFallback } = require('../middleware/spaFallback.ts');
  app.get('*', createSpaFallback(distPath));
}

module.exports = {
  mountStaticAssets,
  registerSpaFallback,
};
