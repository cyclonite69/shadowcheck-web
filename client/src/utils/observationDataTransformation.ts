import type { Observation } from '../types/network';

type ObservationApiRow = Record<string, unknown>;

const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

export function mapObservationApiRow(row: ObservationApiRow): Observation | null {
  const bssid = String(row.bssid || '').toUpperCase();
  const lat = toFiniteNumber(row.lat);
  const lon = toFiniteNumber(row.lon);

  if (!bssid || lat === null || lon === null) {
    return null;
  }

  const signal = toFiniteNumber(row.signal ?? row.level);
  const radioFrequency = toFiniteNumber(row.radio_frequency);
  const altitude = toFiniteNumber(row.altitude);
  const accuracy = toFiniteNumber(row.accuracy);

  return {
    id: (row.obs_number as string | number) || `${bssid}-${String(row.time || '')}`,
    bssid,
    lat,
    lon,
    signal,
    time: typeof row.time === 'string' ? row.time : undefined,
    frequency: radioFrequency,
    acc: accuracy,
    altitude,
    capabilities: String(row.radio_capabilities || ''),
  };
}

export function groupObservationRowsByBssid(
  rows: ObservationApiRow[]
): Record<string, Observation[]> {
  return rows.reduce<Record<string, Observation[]>>((acc, row) => {
    const mapped = mapObservationApiRow(row);
    if (!mapped) return acc;
    if (!acc[mapped.bssid]) acc[mapped.bssid] = [];
    acc[mapped.bssid].push(mapped);
    return acc;
  }, {});
}
