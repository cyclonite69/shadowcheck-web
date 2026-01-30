/**
 * Credentials initialization helpers.
 */

/**
 * Validate and initialize credentials manager.
 * @returns {Promise<object>} Credentials manager instance
 */
async function initializeCredentials() {
  const { validateSecrets } = require('./validateSecrets.ts');
  const secretsManager = require('../services/secretsManager');

  await validateSecrets();

  return secretsManager;
}

module.exports = {
  initializeCredentials,
};
