import secretsManager from '../secretsManager';
import { fetchWigle } from '../wigleClient';
import { hashRecord } from '../wigleRequestUtils';

export async function getUserStats(): Promise<any> {
  const name = secretsManager.get('wigle_api_name');
  const token = secretsManager.get('wigle_api_token');

  if (!name || !token) {
    throw new Error('WiGLE API credentials not configured');
  }

  const encoded = Buffer.from(`${name}:${token}`).toString('base64');

  const response = await fetchWigle({
    kind: 'stats',
    url: 'https://api.wigle.net/api/v2/stats/user',
    timeoutMs: 15000,
    maxRetries: 0,
    label: 'WiGLE User Stats',
    entrypoint: 'stats',
    paramsHash: hashRecord({ endpoint: 'v2/stats/user' }),
    endpointType: 'v2/stats/user',
    init: {
      headers: {
        Authorization: `Basic ${encoded}`,
      },
    },
  });

  if (!response.ok) {
    const errorData: any = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `WiGLE API error: ${response.status}`);
  }

  return response.json();
}
