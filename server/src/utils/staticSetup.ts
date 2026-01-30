/**
 * Static asset helpers.
 */
import type { Express } from 'express';

/**
 * Mount static assets from the provided path.
 */
function mountStaticAssets(app: Express, distPath: string): void {
  const { mountStaticAssets: mountAssets } = require('../middleware/staticAssets');
  mountAssets(app, distPath);
}

/**
 * Register SPA fallback handler.
 */
function registerSpaFallback(app: Express, distPath: string): void {
  const { createSpaFallback } = require('../middleware/spaFallback');
  app.get('*', createSpaFallback(distPath));
}

export { mountStaticAssets, registerSpaFallback };
