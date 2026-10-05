/**
 * Query database using custom spatial-temporal parameters and firmware-based signature scoring.
 * Returns detection_score (0–4) and device_type for each candidate observation.
 *
 * Score levels:
 *   4 — Flock BLE UUID exact match (FLOCK_NEW_FIRMWARE)
 *   3 — Flock 10-digit SSID / Penguin pattern (FLOCK_LEGACY)
 *   2 — ShotSpotter/SoundThinking SSID prefix (SHOTSPOTTER_SENSOR)
 *   1 — Weak BLE heuristic (FLOCK_CANDIDATE)
 *   0 — No signature match (spatial-only candidate)
 */
export async function queryCorrelatedObservations(
  queryFn: (sql: string, params: any[]) => Promise<any>,
  lon: number,
  lat: number,
  timestamp: string,
  radiusMeters: number = 50,
  windowHours: number = 2,
  limit: number = 5,
  mediaDurationS: number = 0
): Promise<any[]> {
  const baseDate = new Date(timestamp);
  const startTime = new Date(baseDate.getTime() - windowHours * 60 * 60 * 1000).toISOString();
  const endTime = new Date(
    baseDate.getTime() + windowHours * 60 * 60 * 1000 + mediaDurationS * 1000
  ).toISOString();

  const dbQuery = `
    SELECT
      id,
      bssid,
      ssid,
      radio_type,
      radio_service,
      level AS signal,
      observed_at,
      lat,
      lon,
      ROUND(ST_Distance(
        ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography,
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
      )::numeric, 2) AS dist_meters,
      ROUND(ABS(EXTRACT(EPOCH FROM (observed_at - $3::timestamptz))) / 60, 1)
        AS delta_minutes,
      CASE
        WHEN radio_service ILIKE '%3e1d50cd-7e3e-427d-8e1c-b78aa87fe624%' THEN 4
        WHEN ssid ~ '^[0-9]{10}$'                                           THEN 3
        WHEN ssid ~ '^Penguin-[0-9]{10}$'                                   THEN 3
        WHEN ssid ~* '^(SoundThinking|ShotSpotter|SST-)'                    THEN 2
        WHEN ssid ~ '^(CBCI|HOME|CAR|BT|GC|LB|MTS|AUTO|TFGF|KG|RN|JB|JR|JW)-[0-9]' THEN 2
        WHEN ssid = '4' AND radio_type = 'E'                                THEN 1
        ELSE 0
      END AS detection_score,
      CASE
        WHEN radio_service ILIKE '%3e1d50cd-7e3e-427d-8e1c-b78aa87fe624%' THEN 'FLOCK_SAFETY_CAMERA'
        WHEN ssid ~ '^[0-9]{10}$'                                           THEN 'FLOCK_SAFETY_CAMERA'
        WHEN ssid ~ '^Penguin-[0-9]{10}$'                                   THEN 'FLOCK_SAFETY_CAMERA'
        WHEN ssid ~* '^(SoundThinking|ShotSpotter|SST-)'                    THEN 'SHOTSPOTTER_SENSOR'
        WHEN ssid ~ '^(CBCI|HOME|CAR|BT|GC|LB|MTS|AUTO|TFGF|KG|RN|JB|JR|JW)-[0-9]' THEN 'SHOTSPOTTER_SENSOR'
        WHEN ssid = '4' AND radio_type = 'E'                                THEN 'FLOCK_SAFETY_CAMERA'
        ELSE NULL
      END AS device_type
    FROM app.observations
    WHERE
      ST_DWithin(
        geom::geography,
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
        $4
      )
      AND observed_at BETWEEN $5::timestamptz AND $6::timestamptz
    ORDER BY detection_score DESC, dist_meters ASC, ABS(delta_minutes) ASC
    LIMIT $7
  `;

  const { rows } = await queryFn(dbQuery, [
    lon,
    lat,
    timestamp,
    radiusMeters,
    startTime,
    endTime,
    limit,
  ]);
  return rows;
}
