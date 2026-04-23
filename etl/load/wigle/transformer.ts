import { WiGLEObservationSchema } from '../../utils/schemas';
import { logDeadLetter } from '../../utils/deadLetter';
import { SqliteLocationRow, SqliteNetworkRow, ValidatedObservation } from './types';

const cleanString = (s: string | null | undefined): string | null => {
  if (!s) return null;
  const cleaned = s.replace(/\x00/g, '').trim();
  return cleaned || null;
};

export const validateAndEnrich = (
  row: SqliteLocationRow,
  networkCache: Map<string, SqliteNetworkRow>,
  sourceTag: string
): ValidatedObservation | null => {
  const bssid = row.bssid.toUpperCase();
  const network = networkCache.get(bssid);

  const observation = {
    source_pk: String(row._id),
    device_id: sourceTag,
    bssid: bssid,
    ssid: cleanString(network?.ssid),
    radio_type: network?.type || 'W',
    radio_frequency: network?.frequency || null,
    radio_capabilities: cleanString(network?.capabilities),
    radio_service: cleanString(network?.service),
    radio_rcois: cleanString(network?.rcois),
    radio_lasttime_ms: network?.lasttime || null,
    level: row.level,
    lat: row.lat,
    lon: row.lon,
    altitude: row.altitude || 0,
    accuracy: row.accuracy || 0,
    time: new Date(row.time),
    time_ms: row.time,
    observed_at_ms: row.time,
    external: row.external === 1,
    mfgrid: row.mfgrid || 0,
    source_tag: sourceTag,
  };

  const result = WiGLEObservationSchema.safeParse(observation);
  if (!result.success) {
    const errorMsg = `Validation failed for ${bssid} (${row._id}): ${result.error.message}`;
    void logDeadLetter(observation, errorMsg);
    return null;
  }
  return result.data as ValidatedObservation;
};
