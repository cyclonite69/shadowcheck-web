/**
 * App initialization helpers.
 */
import type { Express } from 'express';
import helmet from 'helmet';

interface ServerConfig {
  port: number;
  host: string;
  forceHttps: boolean;
  allowedOrigins: string[];
}

interface AppInitResult extends ServerConfig {
  app: Express;
}

/**
 * Initialize Express app and load server configuration.
 */
function initializeApp(express: () => Express): AppInitResult {
  const app = express();

  // Trust proxy for X-Forwarded-* headers (nginx, ALB, CloudFront)
  app.set('trust proxy', 1);

  app.use(helmet());
  const { getServerConfig } = require('./serverConfig');
  const config: ServerConfig = getServerConfig();

  return {
    app,
    port: config.port,
    host: config.host,
    forceHttps: config.forceHttps,
    allowedOrigins: config.allowedOrigins,
  };
}

export { initializeApp, ServerConfig, AppInitResult };
