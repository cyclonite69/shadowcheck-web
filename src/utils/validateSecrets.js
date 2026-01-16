const secretsManager = require('../services/secretsManager');
const logger = require('../logging/logger');

async function validateSecrets() {
  try {
    await secretsManager.load();
    return true;
  } catch (error) {
    logger.error('SECRETS VALIDATION FAILED');
    logger.error(error.message);
    logger.error('Server cannot start without required secrets.');
    process.exit(1);
  }
}

module.exports = { validateSecrets };
