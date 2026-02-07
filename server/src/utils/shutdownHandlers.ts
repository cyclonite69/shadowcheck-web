import type { Pool } from 'pg';

interface ShutdownDependencies {
  logger: {
    info: (message: string) => void;
  };
  pool: Pool;
}

/**
 * Register process shutdown handlers.
 */
function registerShutdownHandlers({ logger, pool }: ShutdownDependencies): void {
  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, closing server gracefully...');
    const BackgroundJobsService = require('../services/backgroundJobsService');
    BackgroundJobsService.shutdown();
    const { shutdownSsmWebSocket } = require('../websocket/ssmTerminal');
    await shutdownSsmWebSocket();
    await pool.end();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    logger.info('SIGINT received, closing server gracefully...');
    const { shutdownSsmWebSocket } = require('../websocket/ssmTerminal');
    await shutdownSsmWebSocket();
    await pool.end();
    process.exit(0);
  });
}

export { registerShutdownHandlers };
