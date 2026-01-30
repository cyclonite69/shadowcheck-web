/**
 * Server lifecycle helpers.
 */
import type { Pool } from 'pg';

interface Logger {
  info: (message: string, meta?: unknown) => void;
  warn: (message: string, meta?: unknown) => void;
  error: (message: string, meta?: unknown) => void;
  debug: (message: string, meta?: unknown) => void;
}

interface LifecycleOptions {
  logger: Logger;
  pool: Pool;
}

/**
 * Initialize background jobs and register shutdown handlers.
 */
async function initializeLifecycle(options: LifecycleOptions): Promise<void> {
  const { logger, pool } = options;

  const { initializeBackgroundJobs } = require('./backgroundJobsInit');
  await initializeBackgroundJobs();

  const { registerShutdownHandlers } = require('./shutdownHandlers');
  registerShutdownHandlers({ logger, pool });
}

export { initializeLifecycle, LifecycleOptions, Logger };
