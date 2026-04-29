import type { Request } from 'express';
import { parsePagination, type PaginationParams } from './parsers/pagination';
import { parseThreatFilters, type ThreatFilterParams } from './parsers/threatFilters';
import { parseSpatialFilters, type SpatialFilterParams } from './parsers/spatialFilters';
import { parseSignalFilters, type SignalFilterParams } from './parsers/signalFilters';
import { parseNetworkIdentity, type NetworkIdentityParams } from './parsers/networkIdentity';

export type NetworkListParams = PaginationParams &
  ThreatFilterParams &
  SpatialFilterParams &
  SignalFilterParams &
  NetworkIdentityParams & {
    planCheck: boolean;
    sort: unknown;
    order: unknown;
  };

type ParseError = { ok: false; status: 400; error: string };
type ParseSuccess = { ok: true; params: NetworkListParams };

export const parseNetworkListParams = (req: Request): ParseError | ParseSuccess => {
  const q = req.query;

  const paginationResult = parsePagination(q.limit, q.offset);
  if (!paginationResult.ok) return paginationResult;

  const threatResult = parseThreatFilters(
    q.threat_level,
    q.threat_categories,
    q.threat_score_min,
    q.threat_score_max
  );
  if (!threatResult.ok) return threatResult;

  const spatialResult = parseSpatialFilters(
    String(q.location_mode || 'latest_observation'),
    q.distance_from_home_km,
    q.distance_from_home_km_min,
    q.distance_from_home_km_max,
    q.bbox_min_lat,
    q.bbox_max_lat,
    q.bbox_min_lng,
    q.bbox_max_lng,
    q.radius_center_lat,
    q.radius_center_lng,
    q.radius_meters
  );
  if (!spatialResult.ok) return spatialResult;

  const signalResult = parseSignalFilters(
    q.last_seen,
    q.min_signal,
    q.max_signal,
    q.min_obs_count,
    q.max_obs_count
  );
  if (!signalResult.ok) return signalResult;

  const identityResult = parseNetworkIdentity(
    q.ssid,
    q.bssid,
    q.q,
    q.manufacturer,
    q.radioTypes,
    q.encryptionTypes,
    q.authMethods,
    q.insecureFlags,
    q.securityFlags
  );
  if (!identityResult.ok) return identityResult;

  return {
    ok: true,
    params: {
      ...paginationResult.params,
      ...threatResult.params,
      ...spatialResult.params,
      ...signalResult.params,
      ...identityResult.params,
      planCheck: q.planCheck === '1',
      sort: q.sort || 'last_seen',
      order: q.order || 'DESC',
    },
  };
};
