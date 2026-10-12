import { tableFromIPC } from 'apache-arrow';
import type { NetworkData } from '../components/kepler/types';

export interface KeplerArrowData {
  networkData: NetworkData[];
  timeBounds: { min: number; max: number } | null;
  uniqueNetworks: number;
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === 'bigint') {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }
  return null;
}

export function mapKeplerArrowToNetworkData(buffer: ArrayBuffer): KeplerArrowData {
  const table = tableFromIPC(new Uint8Array(buffer));
  const ids = table.getChild('id');
  const longitudes = table.getChild('lon');
  const latitudes = table.getChild('lat');
  const levels = table.getChild('level');
  const observedTimes = table.getChild('observed_at_ms');
  const bssids = table.getChild('bssid');
  const ssids = table.getChild('ssid');

  if (!longitudes || !latitudes || !levels || !observedTimes || !bssids || !ssids) {
    throw new Error('Arrow observations stream is missing required columns');
  }

  const networkData: NetworkData[] = [];
  const uniqueBssids = new Set<string>();
  let minTime = Infinity;
  let maxTime = -Infinity;

  for (let index = 0; index < table.numRows; index += 1) {
    const lon = finiteNumber(longitudes.get(index));
    const lat = finiteNumber(latitudes.get(index));
    const level = finiteNumber(levels.get(index)) ?? -100;
    const observedAtMs = finiteNumber(observedTimes.get(index));
    if (lon === null || lat === null || observedAtMs === null) {
      continue;
    }

    const bssid = String(bssids.get(index) ?? '');
    const ssid = String(ssids.get(index) || 'Hidden');
    const id = ids?.get(index);
    minTime = Math.min(minTime, observedAtMs);
    maxTime = Math.max(maxTime, observedAtMs);
    if (bssid) {
      uniqueBssids.add(bssid);
    }

    networkData.push({
      id: id === null || id === undefined ? undefined : String(id),
      position: [lon, lat],
      lon,
      lat,
      bssid,
      ssid,
      signal: level,
      level,
      encryption: 'Unknown',
      channel: 0,
      frequency: 0,
      manufacturer: 'Unknown',
      device_type: 'unknown',
      type: 'unknown',
      capabilities: 'Unknown',
      timestamp: new Date(observedAtMs).toISOString(),
      last_seen: new Date(observedAtMs).toISOString(),
      observed_at_ms: observedAtMs,
    });
  }

  return {
    networkData,
    timeBounds:
      Number.isFinite(minTime) && Number.isFinite(maxTime) ? { min: minTime, max: maxTime } : null,
    uniqueNetworks: uniqueBssids.size,
  };
}
