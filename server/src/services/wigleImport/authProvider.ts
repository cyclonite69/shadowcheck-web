import secretsManager from '../secretsManager';

/**
 * Retrieve and encode WiGLE API credentials for Basic Auth
 */
export const getEncodedWigleAuth = (): string => {
  const wigleApiName = secretsManager.get('wigle_api_name');
  const wigleApiToken = secretsManager.get('wigle_api_token');
  if (!wigleApiName || !wigleApiToken) {
    throw new Error(
      'WiGLE API credentials not configured. Set wigle_api_name and wigle_api_token secrets.'
    );
  }
  return Buffer.from(`${wigleApiName}:${wigleApiToken}`).toString('base64');
};
