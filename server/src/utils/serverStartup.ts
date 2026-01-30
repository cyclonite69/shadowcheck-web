/**
 * Server startup helpers.
 */
import type { Express } from 'express';
import type { Server } from 'http';

interface Logger {
  info: (message: string, meta?: unknown) => void;
  warn: (message: string, meta?: unknown) => void;
  error: (message: string, meta?: unknown) => void;
  debug: (message: string, meta?: unknown) => void;
}

interface StartupOptions {
  port: number;
  host: string;
  forceHttps: boolean;
  logger: Logger;
}

/**
 * Start the HTTP server and log configuration details.
 */
function startServer(app: Express, options: StartupOptions): Server {
  const { port, host, forceHttps, logger } = options;

  return app.listen(port, host, () => {
    logger.info(`Server listening on port ${port}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`HTTPS redirect: ${forceHttps ? 'enabled' : 'disabled'}`);
  });
}

export { startServer, StartupOptions };
