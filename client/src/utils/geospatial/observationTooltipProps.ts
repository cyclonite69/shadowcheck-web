import { frequencyToChannel } from '../mapHelpers';
import type { NetworkRow, Observation } from '../../types/network';

export const buildObservationTooltipProps = ({
  obs,
  network,
  threatLevel,
  deltaMeters,
  timeSincePrior,
  timeSincePriorMs,
  number,
  color,
  coChannelNeighbors = 0,
}: {
  obs: Observation;
  network: NetworkRow | undefined;
  threatLevel: string;
  deltaMeters: number | null;
  timeSincePrior: string | null;
  timeSincePriorMs: number | null;
  number: number;
  color: string;
  coChannelNeighbors?: number;
}) => {
  const frequency = obs.frequency ?? network?.frequency ?? null;
  const channel = frequencyToChannel(frequency) ?? network?.channel ?? null;
  const signal = obs.signal ?? obs.level ?? network?.signal ?? null;

  return {
    bssid: obs.bssid,
    signal,
    level: signal,
    time: obs.time,
    frequency,
    channel,
    altitude: obs.altitude,
    ssid: network?.ssid || '(hidden)',
    manufacturer: network?.manufacturer || null,
    security: network?.security || null,
    capabilities: obs.capabilities || network?.capabilities || network?.security || null,
    threat_level: threatLevel,
    threat_score: network?.threat_score ?? null,
    first_seen: network?.firstSeen || null,
    last_seen: network?.lastSeen || null,
    timespan_days: typeof network?.timespanDays === 'number' ? network.timespanDays : null,
    distance_from_home_km:
      obs.distance_from_home_km ??
      (typeof network?.distanceFromHome === 'number' ? network.distanceFromHome / 1000 : null),
    max_distance_km:
      typeof network?.max_distance_meters === 'number' ? network.max_distance_meters / 1000 : null,
    distance_from_last_point_m: deltaMeters,
    time_since_prior: timeSincePrior,
    time_since_prior_ms: timeSincePriorMs,
    observation_count: network?.observations ?? 0,
    accuracy: obs.acc ?? network?.accuracy ?? null,
    unique_days: (network as any)?.unique_days ?? null,
    type: network?.type || null,
    radio_type: network?.type || null,
    number,
    color,
    co_channel_neighbors: coChannelNeighbors,
  };
};
