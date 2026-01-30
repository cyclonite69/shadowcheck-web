/**
 * App initialization helpers.
 */
import type { Express } from 'express';

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
