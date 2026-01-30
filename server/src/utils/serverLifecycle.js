/**
 * Server lifecycle helpers.
 */

/**
 * Initialize background jobs and register shutdown handlers.
 * @param {{ logger: object, pool: import('pg').Pool }} options - Lifecycle options
 * @returns {Promise<void>}
 */
async function initializeLifecycle(options) {
  const { logger, pool } = options;

  const { initializeBackgroundJobs } = require('./backgroundJobsInit');
  await initializeBackgroundJobs();

  const { registerShutdownHandlers } = require('./shutdownHandlers.ts');
  registerShutdownHandlers({ logger, pool });
}

module.exports = {
  initializeLifecycle,
};
