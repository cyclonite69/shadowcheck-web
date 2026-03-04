/**
 * Threat Report Service
 * Builds structured report data and delegates rendering to report renderers.
 */

const { query } = require('../config/database');
const observationService = require('./observationService');
const { toNumber, formatTimestamp } = require('./reports/threatReportUtils');
const { renderMarkdown, renderHtml, renderPdfBuffer } = require('./reports/threatReportRenderers');

async function getThreatReportData(bssid: string) {
  const normalizedBssid = String(bssid || '')
    .trim()
    .toUpperCase();

  const networkResult = await query(
    `SELECT
       UPPER(mv.bssid) AS bssid,
       mv.ssid,
       mv.manufacturer,
       mv.type,
       mv.observations,
       mv.max_distance_meters,
       mv.last_seen,
       mv.first_seen,
       COALESCE(NULLIF(mv.security, ''), NULLIF(mv.capabilities, '')) AS encryption,
       mv.frequency,
       nts.rule_based_score,
       nts.final_threat_score,
       nts.final_threat_level,
       nts.rule_based_flags,
       COALESCE(nt.is_ignored, false) AS is_ignored,
       nt.threat_tag
     FROM app.api_network_explorer_mv mv
     LEFT JOIN app.network_threat_scores nts
       ON UPPER(nts.bssid) = UPPER(mv.bssid)
     LEFT JOIN app.network_tags nt
       ON UPPER(nt.bssid) = UPPER(mv.bssid)
     WHERE UPPER(mv.bssid) = $1
     LIMIT 1`,
    [normalizedBssid]
  );

  if (!networkResult.rows[0]) {
    return null;
  }

  const network = networkResult.rows[0];
  const home = await observationService.getHomeLocationForObservations();
  const observations = await observationService.getObservationsByBSSID(
    normalizedBssid,
    home?.lon ?? null,
    home?.lat ?? null
  );

  const observationTimes = observations
    .map((o: any) => toNumber(o.time))
    .filter((t: number | null): t is number => t !== null)
    .sort((a: number, b: number) => a - b);

  const firstObsTime = observationTimes.length > 0 ? observationTimes[0] : null;
  const lastObsTime =
    observationTimes.length > 0 ? observationTimes[observationTimes.length - 1] : null;
  const spanDays =
    firstObsTime && lastObsTime
      ? Number(((lastObsTime - firstObsTime) / (1000 * 60 * 60 * 24)).toFixed(1))
      : 0;

  const uniqueDays = new Set(
    observationTimes.map((t: number) => new Date(t).toISOString().slice(0, 10))
  ).size;

  const distanceKm = observations
    .map((o: any) => toNumber(o.distance_from_home_km))
    .filter((d: number | null): d is number => d !== null);

  const bucket = {
    home: 0,
    near: 0,
    neighborhood: 0,
    away: 0,
    unknown: 0,
  };

  for (const d of distanceKm) {
    if (d < 0.1) bucket.home += 1;
    else if (d < 0.5) bucket.near += 1;
    else if (d < 2) bucket.neighborhood += 1;
    else bucket.away += 1;
  }
  bucket.unknown = observations.length - distanceKm.length;

  const awayLocations = observations
    .map((o: any) => ({
      lat: toNumber(o.lat),
      lon: toNumber(o.lon),
      time: toNumber(o.time),
      distanceKm: toNumber(o.distance_from_home_km),
      signal: toNumber(o.signal),
    }))
    .filter((o: any) => o.distanceKm !== null && o.distanceKm >= 2 && o.time !== null)
    .sort((a: any, b: any) => (b.distanceKm || 0) - (a.distanceKm || 0))
    .slice(0, 25);

  const homeLikeCount = bucket.home + bucket.near;
  const homeLikePct =
    observations.length > 0 ? Number(((homeLikeCount / observations.length) * 100).toFixed(1)) : 0;
  const followEventCount = observations.filter((o: any) => {
    const d = toNumber(o.distance_from_home_km);
    return d !== null && d >= 0.5;
  }).length;
  const followEventPct =
    observations.length > 0
      ? Number(((followEventCount / observations.length) * 100).toFixed(1))
      : 0;

  return {
    generatedAt: formatTimestamp(Date.now()),
    network: {
      bssid: network.bssid,
      ssid: network.ssid || '(hidden)',
      manufacturer: network.manufacturer || '<NULL>',
      type: network.type || 'W',
      encryption: network.encryption || 'N/A',
      frequency: network.frequency,
      observationsMv: toNumber(network.observations) || 0,
      firstSeen: network.first_seen,
      lastSeen: network.last_seen,
      maxDistanceMeters: toNumber(network.max_distance_meters),
      isIgnored: Boolean(network.is_ignored),
      threatTag: network.threat_tag || null,
    },
    threat: {
      ruleBasedScore: toNumber(network.rule_based_score),
      finalThreatScore: toNumber(network.final_threat_score),
      finalThreatLevel: network.final_threat_level || 'NONE',
      flags: network.rule_based_flags || {},
    },
    observations: {
      count: observations.length,
      uniqueDays,
      firstSeen: formatTimestamp(firstObsTime),
      lastSeen: formatTimestamp(lastObsTime),
      spanDays,
      distanceBuckets: bucket,
      awayLocations,
      behavioralContext: {
        homeLikeCount,
        homeLikePct,
        followEventCount,
        followEventPct,
      },
    },
  };
}

module.exports = {
  getThreatReportData,
  renderMarkdown,
  renderHtml,
  renderPdfBuffer,
};
