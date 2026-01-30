import type { RequestHandler } from 'express';

/**
 * HTTPS redirect middleware (for deployments behind a proxy).
 */
function createHttpsRedirect(): RequestHandler {
  return (req, res, next) => {
    if (req.headers['x-forwarded-proto'] !== 'https' && req.hostname !== 'localhost') {
      return res.redirect(301, `https://${req.hostname}${req.url}`);
    }
    return next();
  };
}

export { createHttpsRedirect };
