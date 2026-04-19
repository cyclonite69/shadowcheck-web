import type { Pool } from 'pg';

interface ShutdownDependencies {
  logger: {
    info: (message: string) => void;
    error: (message: string) => void;
  };
  pool: Pool;
}

/**
 * Register process shutdown handlers.
 */
function registerShutdownHandlers({ logger, pool }: ShutdownDependencies): void {
  const shutdown = async (signal: string) => {
    logger.info(`${signal} received, closing server gracefully...`);
    
    try {
      const BackgroundJobsService = require('../services/backgroundJobsService');
      BackgroundJobsService.shutdown();
    } catch (err: any) {
      logger.error(`Error during BackgroundJobsService shutdown: ${err.message}`);
    }

    try {
      const { shutdownSsmWebSocket } = require('../websocket/ssmTerminal');
      await shutdownSsmWebSocket();
    } catch (err: any) {
      logger.error(`Error during SSM WebSocket shutdown: ${err.message}`);
    }

    try {
      // Set a timeout for pool.end() to prevent hanging on pending I/O
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Database pool shutdown timed out')), 5000)
      );
      
      await Promise.race([pool.end(), timeoutPromise]);
      logger.info('Database pool closed successfully.');
    } catch (err: any) {
      logger.error(`Error during database pool shutdown: ${err.message}`);
    }

    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

export { registerShutdownHandlers };
