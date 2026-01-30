const path = require('path');

/**
 * Creates an SPA fallback handler for React Router apps.
 * @param {string} distDir - Absolute path to the built dist directory
 * @returns {import('express').RequestHandler} Express handler
 */
function createSpaFallback(distDir) {
  return (req, res) => {
    if (
      req.path.startsWith('/api') ||
      req.path.startsWith('/demo') ||
      req.path.startsWith('/analytics-public')
    ) {
      return res.status(404).json({ error: 'Not found' });
    }
    return res.sendFile(path.join(distDir, 'index.html'));
  };
}

module.exports = { createSpaFallback };
