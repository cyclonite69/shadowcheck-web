import secretsManager from '../secretsManager';
import { wigleGatewayFetch } from './wigleGateway';

export async function getUserStats(): Promise<any> {
  const name = secretsManager.get('wigle_api_name');
  const token = secretsManager.get('wigle_api_token');

  if (!name || !token) {
    const err: any = new Error('WiGLE API credentials not configured');
    err.status = 503;
    throw err;
  }

  const encoded = Buffer.from(`${name}:${token}`).toString('base64');

  const result = await wigleGatewayFetch({
    kind: 'stats',
    url: 'https://api.wigle.net/api/v2/stats/user',
    timeoutMs: 15000,
    maxRetries: 0,
    label: 'WiGLE User Stats',
    entrypoint: 'stats',
    endpointType: 'v2/stats/user',
    query_source: 'manual',
    init: {
      headers: {
        Authorization: `Basic ${encoded}`,
      },
    },
  });

  if (!result.ok) {
    const err: any = new Error(result.error || `WiGLE API error: ${result.status}`);
    if (result.status !== undefined) {
      err.status = result.status;
    }
    throw err;
  }

  const response = result.response;
  if (!response.ok) {
    const errorData: any = await response.json().catch(() => ({}));
    const err: any = new Error(errorData.message || `WiGLE API error: ${response.status}`);
    err.status = response.status;
    throw err;
  }

  const data = await response.json();
  return normalizeUserStats(data);
}

export function normalizeUserStats(raw: any): any {
  return {
    user: raw.statistics?.userName ?? raw.user ?? null,
    rank: raw.statistics?.rank ?? raw.rank ?? null,
    imageBadgeUrl: raw.statistics?.imageBadgeUrl ?? null,
    discoveredWiFiGPS: raw.statistics?.discoveredWiFiGPS ?? null,
    discoveredBtGPS: raw.statistics?.discoveredBtGPS ?? null,
    discoveredCellGPS: raw.statistics?.discoveredCellGPS ?? null,
    discoveredWiFi: raw.statistics?.discoveredWiFi ?? null,
    discoveredBt: raw.statistics?.discoveredBt ?? null,
    discoveredCell: raw.statistics?.discoveredCell ?? null,
    totalWiFiLocations: raw.statistics?.totalWiFiLocations ?? null,
    first: raw.statistics?.first ?? raw.first ?? null,
    last: raw.statistics?.last ?? raw.last ?? null,
    eventMonthCount: raw.statistics?.eventMonthCount ?? null,
  };
}
