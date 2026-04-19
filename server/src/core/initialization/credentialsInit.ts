/**
 * Credentials initialization helpers.
 */

interface SecretsManager {
  get: (key: string) => string | null;
  getOrThrow: (key: string) => string;
  has: (key: string) => boolean;
  load: () => Promise<void>;
}

/**
 * Validate and initialize credentials manager.
 */
async function initializeCredentials(): Promise<SecretsManager> {
  const { validateSecrets } = require('../../utils/validateSecrets');
  const secretsManager = require('../../services/secretsManager').default;
  const logger = require('../../logging/logger');

  const exit = (code: number): never => {
    process.exit(code);
  };

  await validateSecrets({ secretsManager, logger, exit });

  return secretsManager as SecretsManager;
}

export { initializeCredentials, SecretsManager };
