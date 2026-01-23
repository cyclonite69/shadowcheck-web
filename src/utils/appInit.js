/**
 * App initialization helpers.
 */

/**
 * Initialize Express app and load server configuration.
 * @param {Function} express - Express factory
 * @returns {{ app: import('express').Express, port: number, host: string, forceHttps: boolean, allowedOrigins: string[] }}
 */
function initializeApp(express) {
  const app = express();
  const { getServerConfig } = require('./serverConfig');
  const { port, host, forceHttps, allowedOrigins } = getServerConfig();

  return {
    app,
    port,
    host,
    forceHttps,
    allowedOrigins,
  };
}

module.exports = {
  initializeApp,
};
