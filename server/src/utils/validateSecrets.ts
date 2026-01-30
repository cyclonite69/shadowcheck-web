const secretsManager = require('../services/secretsManager');
const logger = require('../logging/logger');

/**
 * Loads and validates required secrets for application startup.
 * Exits the process if required secrets are missing.
 */
async function validateSecrets(): Promise<boolean> {
  try {
    await secretsManager.load();
    return true;
  } catch (error: unknown) {
    const err = error as Error; // TODO: Better error type handling when secretsManager is typed
    logger.error('SECRETS VALIDATION FAILED');
    logger.error(err.message);
    logger.error('Server cannot start without required secrets.');
    process.exit(1);
  }
}

export { validateSecrets };
