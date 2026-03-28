export {};
const secretsManager = require('../../../../config/container').secretsManager;

const REQUIRED_SECRETS = ['db_password', 'session_secret'];
const ALL_SECRETS = [
  'db_password',
  'session_secret',
  'mapbox_token',
  'wigle_api_key',
  'wigle_api_token',
  'opencage_api_key',
  'locationiq_api_key',
  'google_maps_api_key',
];

const listSecretsStatus = () =>
  ALL_SECRETS.map((key) => ({
    key,
    configured: secretsManager.has(key),
    required: REQUIRED_SECRETS.includes(key),
  }));

const storeSecret = async (key: string, value: string) => {
  if (!value) {
    throw new Error('Value is required');
  }
  await secretsManager.putSecret(key, value);
};

const deleteSecret = async (key: string) => {
  if (REQUIRED_SECRETS.includes(key)) {
    const error: any = new Error('Cannot delete required secrets');
    error.code = 'REQUIRED';
    throw error;
  }
  await secretsManager.deleteSecret(key);
};

module.exports = {
  listSecretsStatus,
  storeSecret,
  deleteSecret,
};
