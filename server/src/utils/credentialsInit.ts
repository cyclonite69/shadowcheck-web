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
  const { validateSecrets } = require('./validateSecrets');
  const secretsManager = require('../services/secretsManager');

  await validateSecrets();

  return secretsManager as SecretsManager;
}

export { initializeCredentials, SecretsManager };
