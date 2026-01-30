/**
 * Static asset middleware.
 */
import type { Express, Response } from 'express';
import express from 'express';
import path from 'path';

/**
 * Mount static asset handlers for the built frontend.
 */
function mountStaticAssets(app: Express, distDir: string): void {
  // Serve hashed assets with long cache (1 year, immutable)
  // Vite generates unique hashes in filenames, so aggressive caching is safe
  app.use(
    '/assets',
    express.static(path.join(distDir, 'assets'), {
      maxAge: '1y',
      immutable: true,
      etag: false, // Not needed with immutable + hashed filenames
    })
  );

  // Serve other static files with short cache (index.html, favicon, etc.)
  app.use(
    express.static(distDir, {
      maxAge: 0, // No cache for index.html (allows instant updates)
      etag: true,
      setHeaders: (res: Response, filePath: string) => {
        // Ensure index.html is never cached
        if (filePath.endsWith('index.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
      },
    })
  );
}

export { mountStaticAssets };
