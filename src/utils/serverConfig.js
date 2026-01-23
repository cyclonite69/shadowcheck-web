/**
 * Server configuration helpers.
 */

/**
 * Build server configuration from environment variables.
 * @returns {{ port: number, host: string, forceHttps: boolean, allowedOrigins: string[] }}
 */
function getServerConfig() {
  const port = Number(process.env.PORT) || 3001;
  const host = process.env.HOST || '0.0.0.0';
  const forceHttps = process.env.FORCE_HTTPS === 'true';

  const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((origin) => origin.trim())
    : ['http://localhost:3001', 'http://127.0.0.1:3001'];

  return {
    port,
    host,
    forceHttps,
    allowedOrigins,
  };
}

module.exports = {
  getServerConfig,
};
