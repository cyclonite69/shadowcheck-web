/**
 * mergeNearestPlaces
 *
 * Merges agency and courthouse nearest-per-cluster results into a single list
 * keyed by cluster_id. When a cluster has both an agency and a courthouse match,
 * they are combined into one item. Clusters with only one type of match are
 * included with the other field as undefined.
 */

import type { Agency } from '../../components/geospatial/hooks/useNearestAgencies';
import type { CourthouseMatch } from '../../api/agencyApi';

export interface NearestPlaceCluster {
  /** Stable key — either the shared cluster_id or a synthetic fallback key. */
  key: string;
  clusterId: number | null;
  /** Centroid lat from agency result, courthouse result, or fallback. */
  clusterLat: number | null;
  clusterLon: number | null;
  observationCount: number | null;
  hasWigleObs: boolean;
  hasLocalObs: boolean;
  agency?: Agency;
  courthouse?: CourthouseMatch;
}

function hasAgencyMatch(agency: Agency): boolean {
  return Boolean(
    agency.name &&
    agency.latitude !== null &&
    agency.latitude !== undefined &&
    agency.longitude !== null &&
    agency.longitude !== undefined
  );
}

function hasCourthouseMatch(courthouse: CourthouseMatch): boolean {
  return Boolean(
    courthouse.name &&
    courthouse.latitude !== null &&
    courthouse.latitude !== undefined &&
    courthouse.longitude !== null &&
    courthouse.longitude !== undefined
  );
}

/**
 * Merge agency rows and courthouse rows by cluster_id.
 * Each backend endpoint runs the same DBSCAN with the same BSSID inputs, so
 * cluster_ids should align. If they don't (e.g. one endpoint returned nothing),
 * the other side's clusters are still included with the absent side as undefined.
 */
export function mergeNearestPlaces(
  agencies: Agency[],
  courthouses: CourthouseMatch[]
): NearestPlaceCluster[] {
  // Index agencies by cluster_id (null/undefined \u2192 key 'agency-0', 'agency-1', ...)
  const map = new Map<string, NearestPlaceCluster>();

  agencies.forEach((agency, idx) => {
    const cid = agency.cluster_id;
    const key = cid !== null && cid !== undefined ? String(cid) : `agency-${idx}`;
    const matchedAgency = hasAgencyMatch(agency) ? agency : undefined;
    map.set(key, {
      key,
      clusterId: cid ?? null,
      clusterLat: agency.cluster_lat ?? agency.latitude ?? null,
      clusterLon: agency.cluster_lon ?? agency.longitude ?? null,
      observationCount: agency.cluster_count ?? null,
      hasWigleObs: agency.has_wigle_obs ?? false,
      hasLocalObs: agency.has_local_obs ?? true,
      agency: matchedAgency,
      courthouse: undefined,
    });
  });

  courthouses.forEach((ch, idx) => {
    const cid = ch.cluster_id;
    const key = cid !== null && cid !== undefined ? String(cid) : `courthouse-${idx}`;
    const matchedCourthouse = hasCourthouseMatch(ch) ? ch : undefined;
    const existing = map.get(key);
    if (existing) {
      existing.courthouse = matchedCourthouse;
      // Prefer agency centroid; fall back to courthouse centroid if missing
      if (existing.clusterLat === null) {
        existing.clusterLat = ch.cluster_lat ?? ch.latitude ?? null;
        existing.clusterLon = ch.cluster_lon ?? ch.longitude ?? null;
      }
      // Merge source flags
      if (ch.has_wigle_obs) {
        existing.hasWigleObs = true;
      }
      if (ch.has_local_obs) {
        existing.hasLocalObs = true;
      }
    } else {
      map.set(key, {
        key,
        clusterId: cid ?? null,
        clusterLat: ch.cluster_lat ?? ch.latitude ?? null,
        clusterLon: ch.cluster_lon ?? ch.longitude ?? null,
        observationCount: ch.cluster_count ?? null,
        hasWigleObs: ch.has_wigle_obs ?? false,
        hasLocalObs: ch.has_local_obs ?? true,
        agency: undefined,
        courthouse: matchedCourthouse,
      });
    }
  });

  // Sort: numeric cluster_id first (ascending), then synthetic keys last
  return Array.from(map.values()).sort((a, b) => {
    if (a.clusterId !== null && b.clusterId !== null) {
      return a.clusterId - b.clusterId;
    }
    if (a.clusterId !== null) {
      return -1;
    }
    if (b.clusterId !== null) {
      return 1;
    }
    return a.key.localeCompare(b.key);
  });
}
