import { query } from '../../config/database';
import {
  buildWigleNetworksMvQuery,
  buildWiglePageGeocodedAddressQuery,
  buildWiglePageLocalMatchQuery,
  buildWiglePageMostRecentObsQuery,
  buildWiglePageV2SummaryQuery,
  buildWiglePageV3DetailQuery,
  buildWiglePageV3TemporalQuery,
} from '../../repositories/wigleQueriesRepository';
import { getWigleNetworkByBSSID } from './database';
import { getStoredWigleDetail } from './persistence';

export async function getWiglePageNetwork(netid: string): Promise<{
  wigle: Record<string, unknown>;
  localLinkage: {
    has_local_match: boolean;
    local_observation_count: number;
    local_first_seen: string | null;
    local_last_seen: string | null;
  };
} | null> {
  const normalizedNetid = netid.trim().toUpperCase();
  const v3DetailQuery = buildWiglePageV3DetailQuery(normalizedNetid);
  const v2SummaryQuery = buildWiglePageV2SummaryQuery(normalizedNetid);
  const localMatchQuery = buildWiglePageLocalMatchQuery(normalizedNetid);
  const v3TemporalQuery = buildWiglePageV3TemporalQuery(normalizedNetid);
  const recentObsQuery = buildWiglePageMostRecentObsQuery(normalizedNetid);

  const [v3Result, v2Result, localMatchResult, v3TemporalResult, recentObsResult] =
    await Promise.all([
      query(v3DetailQuery.sql, v3DetailQuery.queryParams),
      query(v2SummaryQuery.sql, v2SummaryQuery.queryParams),
      query(localMatchQuery.sql, localMatchQuery.queryParams),
      query(v3TemporalQuery.sql, v3TemporalQuery.queryParams),
      query(recentObsQuery.sql, recentObsQuery.queryParams).catch(() => ({ rows: [] })),
    ]);

  const v3 = v3Result.rows[0] ?? null;
  const v2 = v2Result.rows[0] ?? null;

  if (!v3 && !v2) {
    return null;
  }

  const lm = localMatchResult.rows[0] ?? {};
  const t = v3TemporalResult.rows[0] ?? {};
  const hasV3Obs = (t.wigle_v3_observation_count ?? 0) > 0;
  const manufacturer = v3?.oui_manufacturer ?? v2?.oui_manufacturer ?? null;

  let displayLat: number | null = null;
  let displayLon: number | null = null;
  let displayCoordinateSource: string | null = null;

  if (hasV3Obs && t.wigle_v3_centroid_lat != null) {
    displayLat = t.wigle_v3_centroid_lat;
    displayLon = t.wigle_v3_centroid_lon;
    displayCoordinateSource = 'wigle-v3-centroid';
  } else if (v2?.trilat != null && v2?.trilong != null) {
    displayLat = v2.trilat;
    displayLon = v2.trilong;
    displayCoordinateSource = 'wigle-v2-trilat';
  } else if (v3?.trilat != null) {
    displayLat = v3.trilat;
    displayLon = v3.trilon;
    displayCoordinateSource = 'wigle-v3-summary';
  }

  const spreadM = t.wigle_v3_spread_m ?? null;
  const recentObs = recentObsResult.rows[0] ?? null;

  let geocodedAddress: string | null = null;
  if (displayLat !== null && displayLon !== null) {
    try {
      const geocodeQ = buildWiglePageGeocodedAddressQuery(displayLat, displayLon, 3);
      const geocodeResult = await query(geocodeQ.sql, geocodeQ.queryParams);
      geocodedAddress = geocodeResult.rows[0]?.address ?? null;
    } catch {
      // geocoding_cache may not exist on all deployments
    }
  }

  return {
    wigle: {
      bssid: normalizedNetid,
      ssid: v3?.ssid ?? v3?.name ?? v2?.ssid ?? null,
      name: v3?.name ?? null,
      type: v2?.type ?? v3?.type ?? null,
      encryption: v2?.encryption ?? v3?.encryption ?? null,
      channel: v2?.channel ?? v3?.channel ?? null,
      frequency: v2?.frequency ?? null,
      qos: v2?.qos ?? v3?.qos ?? null,
      comment: v3?.comment ?? null,
      wigle_source: v3 ? 'wigle-v3' : 'wigle-v2',
      wigle_v2_firsttime: v2?.firsttime ?? null,
      wigle_v2_lasttime: v2?.lasttime ?? null,
      wigle_v2_lastupdt: v2?.lastupdt ?? null,
      wigle_v2_trilat: v2?.trilat ?? null,
      wigle_v2_trilong: v2?.trilong ?? null,
      wigle_v2_city: v2?.city ?? null,
      wigle_v2_region: v2?.region ?? null,
      wigle_v2_road: v2?.road ?? null,
      wigle_v2_housenumber: v2?.housenumber ?? null,
      has_wigle_v2_record: v2 !== null,
      wigle_v3_first_seen: hasV3Obs ? (t.wigle_v3_first_seen ?? null) : null,
      wigle_v3_last_seen: hasV3Obs ? (t.wigle_v3_last_seen ?? null) : null,
      wigle_v3_observation_count: hasV3Obs ? (t.wigle_v3_observation_count ?? null) : null,
      wigle_v3_centroid_lat: hasV3Obs ? (t.wigle_v3_centroid_lat ?? null) : null,
      wigle_v3_centroid_lon: hasV3Obs ? (t.wigle_v3_centroid_lon ?? null) : null,
      wigle_v3_spread_m: hasV3Obs ? spreadM : null,
      has_wigle_v3_observations: hasV3Obs,
      display_lat: displayLat,
      display_lon: displayLon,
      display_coordinate_source: displayCoordinateSource,
      manufacturer,
      public_nonstationary_flag: hasV3Obs && spreadM !== null && spreadM > 500,
      public_ssid_variant_flag: hasV3Obs && (t.wigle_v3_ssid_variant_count ?? 0) > 1,
      wigle_precision_warning: hasV3Obs ? (t.wigle_precision_warning ?? false) : false,
      recent_ssid: recentObs?.ssid ?? null,
      recent_channel: recentObs?.channel ?? null,
      recent_frequency: recentObs?.frequency ?? null,
      recent_accuracy: recentObs?.accuracy ?? null,
      geocoded_address: geocodedAddress,
    },
    localLinkage: {
      has_local_match: lm.has_local_match ?? false,
      local_observation_count: lm.local_observation_count ?? 0,
      local_first_seen: lm.local_first_seen ?? null,
      local_last_seen: lm.local_last_seen ?? null,
    },
  };
}

export async function getWiglePageNetworkFromMv(bssid: string): Promise<{
  wigle: Record<string, unknown>;
  localLinkage: {
    has_local_match: boolean;
    local_observation_count: number;
    local_first_seen: string | null;
    local_last_seen: string | null;
  };
} | null> {
  const normalizedBssid = bssid.trim().toUpperCase();
  const { sql, queryParams } = buildWigleNetworksMvQuery(normalizedBssid);
  let row: any;
  try {
    const result = await query(sql, queryParams);
    row = result.rows[0] ?? null;
  } catch {
    return null;
  }
  if (!row) return null;

  let mvRecentObs: any = null;
  let mvGeocodedAddress: string | null = null;

  const recentObsQ = buildWiglePageMostRecentObsQuery(normalizedBssid);
  try {
    const recentObsResult = await query(recentObsQ.sql, recentObsQ.queryParams);
    mvRecentObs = recentObsResult.rows[0] ?? null;
  } catch {
    // wigle_v3_observations may not exist on older deployments
  }

  if (row.display_lat != null && row.display_lon != null) {
    try {
      const geocodeQ = buildWiglePageGeocodedAddressQuery(row.display_lat, row.display_lon, 3);
      const geocodeResult = await query(geocodeQ.sql, geocodeQ.queryParams);
      mvGeocodedAddress = geocodeResult.rows[0]?.address ?? null;
    } catch {
      // geocoding_cache may not exist on all deployments
    }
  }

  return {
    wigle: {
      bssid: row.bssid,
      ssid: row.ssid_display,
      name: row.network_name,
      type: row.network_type,
      encryption: row.encryption,
      channel: row.channel,
      frequency: row.frequency,
      qos: row.qos,
      comment: row.comment,
      wigle_source: row.wigle_source,
      wigle_v2_firsttime: row.wigle_v2_firsttime,
      wigle_v2_lasttime: row.wigle_v2_lasttime,
      wigle_v2_lastupdt: row.wigle_v2_lastupdt ?? null,
      wigle_v2_trilat: row.wigle_v2_trilat_lat,
      wigle_v2_trilong: row.wigle_v2_trilat_lon,
      wigle_v2_city: row.wigle_v2_city,
      wigle_v2_region: row.wigle_v2_region,
      wigle_v2_road: row.wigle_v2_road,
      wigle_v2_housenumber: row.wigle_v2_housenumber,
      has_wigle_v2_record: row.has_wigle_v2_record,
      wigle_v3_first_seen: row.wigle_v3_first_seen,
      wigle_v3_last_seen: row.wigle_v3_last_seen,
      wigle_v3_observation_count: row.wigle_v3_observation_count,
      wigle_v3_centroid_lat: row.wigle_v3_centroid_lat,
      wigle_v3_centroid_lon: row.wigle_v3_centroid_lon,
      wigle_v3_spread_m: row.wigle_v3_spread_m,
      has_wigle_v3_observations: row.has_wigle_v3_observations,
      display_lat: row.display_lat,
      display_lon: row.display_lon,
      display_coordinate_source: row.display_coordinate_source,
      manufacturer: row.manufacturer,
      public_nonstationary_flag: row.public_nonstationary_flag ?? false,
      public_ssid_variant_flag: row.public_ssid_variant_flag ?? false,
      wigle_precision_warning: row.wigle_precision_warning ?? false,
      recent_ssid: mvRecentObs?.ssid ?? null,
      recent_channel: mvRecentObs?.channel ?? null,
      recent_frequency: mvRecentObs?.frequency ?? null,
      recent_accuracy: mvRecentObs?.accuracy ?? null,
      geocoded_address: mvGeocodedAddress,
    },
    localLinkage: {
      has_local_match: row.has_local_match ?? false,
      local_observation_count: row.local_observation_count ?? 0,
      local_first_seen: row.local_first_seen,
      local_last_seen: row.local_last_seen,
    },
  };
}

export async function getWigleDetail(netid: string): Promise<any | null> {
  const rows = await getStoredWigleDetail(netid);

  if (rows.length > 0) return rows[0];

  return getWigleNetworkByBSSID(netid);
}
