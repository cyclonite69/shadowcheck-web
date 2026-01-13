\pset pager off
\set ON_ERROR_STOP on

-- Phase 11: full-flex MV (non-destructive) with manufacturer + distance support

CREATE TABLE IF NOT EXISTS public.oui_manufacturers (
  oui_prefix text PRIMARY KEY,
  organization text,
  address text
);

CREATE INDEX IF NOT EXISTS oui_manufacturers_prefix_idx
  ON public.oui_manufacturers (oui_prefix);

DO $$
BEGIN
  IF to_regclass('app.radio_manufacturers') IS NOT NULL THEN
    INSERT INTO public.oui_manufacturers (oui_prefix, organization, address)
    SELECT
      UPPER(LEFT(REGEXP_REPLACE(prefix, '[^0-9A-Fa-f]', '', 'g'), 6)),
      manufacturer,
      address
    FROM app.radio_manufacturers
    ON CONFLICT (oui_prefix) DO NOTHING;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.get_home_location()
RETURNS TABLE(home_lon double precision, home_lat double precision)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
  IF to_regclass('app.location_markers') IS NOT NULL THEN
    RETURN QUERY
    SELECT
      public.ST_X(location::public.geometry),
      public.ST_Y(location::public.geometry)
    FROM app.location_markers
    WHERE marker_type = 'home'
    LIMIT 1;
    IF FOUND THEN
      RETURN;
    END IF;
  END IF;

  IF to_regclass('public.location_markers') IS NOT NULL THEN
    RETURN QUERY
    SELECT
      public.ST_X(location::public.geometry),
      public.ST_Y(location::public.geometry)
    FROM public.location_markers
    WHERE marker_type = 'home'
    LIMIT 1;
    IF FOUND THEN
      RETURN;
    END IF;
  END IF;

  RETURN QUERY SELECT NULL::double precision, NULL::double precision;
END;
$$;

CREATE MATERIALIZED VIEW IF NOT EXISTS public.api_network_latest_full_mv_v2 AS
SELECT DISTINCT ON (bssid)
  bssid,
  ssid,
  lat,
  lon,
  level,
  accuracy,
  time,
  radio_type,
  radio_frequency,
  radio_capabilities,
  geom,
  altitude
FROM public.observations
WHERE geom IS NOT NULL
  AND bssid NOT IN ('00:00:00:00:00:00', 'FF:FF:FF:FF:FF:FF')
  AND time >= '2000-01-01 UTC'
ORDER BY bssid, time DESC
WITH NO DATA;

CREATE MATERIALIZED VIEW IF NOT EXISTS public.api_network_rollup_full_mv_v2 AS
SELECT
  o.bssid,
  COUNT(*)                   AS obs_count,
  MIN(o.time)                AS first_observed_at,
  MAX(o.time)                AS last_observed_at,
  COUNT(DISTINCT DATE(o.time)) AS unique_days,
  COUNT(DISTINCT o.geom)     AS unique_locations,
  AVG(o.level)               AS avg_signal,
  MIN(o.level)               AS min_signal,
  MAX(o.level)               AS max_signal
FROM public.observations o
JOIN (
  SELECT bssid
  FROM public.api_network_latest_full_mv_v2
  ORDER BY bssid
) l ON l.bssid = o.bssid
WHERE o.geom IS NOT NULL
GROUP BY o.bssid
WITH NO DATA;

CREATE MATERIALIZED VIEW IF NOT EXISTS public.api_network_explorer_full_mv_v2 AS
SELECT
  l.bssid,
  COALESCE(NULLIF(TRIM(l.ssid), ''), '(hidden)') AS ssid,
  COALESCE(l.radio_type, '?') AS type,
  l.time AS observed_at,
  l.lat,
  l.lon,
  l.accuracy AS accuracy_meters,
  l.level AS signal,
  l.radio_frequency AS frequency,
  l.radio_capabilities AS capabilities,
  CASE
    WHEN l.radio_frequency BETWEEN 2412 AND 2484 THEN
      CASE
        WHEN l.radio_frequency = 2484 THEN 14
        ELSE FLOOR((l.radio_frequency - 2412) / 5) + 1
      END
    WHEN l.radio_frequency BETWEEN 5000 AND 5900 THEN
      FLOOR((l.radio_frequency - 5000) / 5)
    WHEN l.radio_frequency BETWEEN 5925 AND 7125 THEN
      FLOOR((l.radio_frequency - 5925) / 5)
    ELSE NULL
  END AS channel,
  CASE
    WHEN COALESCE(l.radio_capabilities, '') = '' THEN 'Open'
    WHEN l.radio_capabilities ILIKE '%WPA3%' THEN 'WPA3 (Secure)'
    WHEN l.radio_capabilities ILIKE '%WPA2%' THEN 'WPA2 (Secure)'
    WHEN l.radio_capabilities ILIKE '%WPA%' THEN 'WPA (Moderate)'
    WHEN l.radio_capabilities ILIKE '%WEP%' THEN 'WEP (Insecure)'
    ELSE 'Open'
  END AS security,
  r.obs_count,
  r.first_observed_at,
  r.last_observed_at,
  r.unique_days,
  r.unique_locations,
  r.avg_signal,
  r.min_signal,
  r.max_signal,
  (l.level > -50) AS threat,
  m.organization AS manufacturer,
  m.address AS manufacturer_address,
  CASE
    WHEN home.home_lat IS NOT NULL
      AND home.home_lon IS NOT NULL
      AND l.lat IS NOT NULL
      AND l.lon IS NOT NULL
    THEN ST_Distance(
      ST_SetSRID(ST_MakePoint(home.home_lon, home.home_lat), 4326)::geography,
      ST_SetSRID(ST_MakePoint(l.lon, l.lat), 4326)::geography
    ) / 1000.0
    ELSE NULL
  END AS distance_from_home_km
FROM public.api_network_latest_full_mv_v2 l
JOIN public.api_network_rollup_full_mv_v2 r USING (bssid)
LEFT JOIN public.oui_manufacturers m
  ON m.oui_prefix = CASE
    WHEN l.bssid ~* '^[0-9A-F]{2}(:[0-9A-F]{2}){5}$'
    THEN UPPER(SUBSTRING(REPLACE(l.bssid, ':', '') FROM 1 FOR 6))
    ELSE NULL
  END
CROSS JOIN LATERAL (SELECT * FROM public.get_home_location()) home
WITH NO DATA;

BEGIN;
SET LOCAL application_name = 'shadowcheck_phase11_refresh_full';
SET LOCAL work_mem = '128MB';
SET LOCAL maintenance_work_mem = '256MB';
SET LOCAL temp_file_limit = '10GB';
SET LOCAL jit = off;
REFRESH MATERIALIZED VIEW public.api_network_latest_full_mv_v2;
REFRESH MATERIALIZED VIEW public.api_network_rollup_full_mv_v2;
REFRESH MATERIALIZED VIEW public.api_network_explorer_full_mv_v2;
COMMIT;

CREATE UNIQUE INDEX IF NOT EXISTS api_network_latest_full_mv_v2_bssid_uidx
  ON public.api_network_latest_full_mv_v2 (bssid);
CREATE UNIQUE INDEX IF NOT EXISTS api_network_rollup_full_mv_v2_bssid_uidx
  ON public.api_network_rollup_full_mv_v2 (bssid);
CREATE UNIQUE INDEX IF NOT EXISTS api_network_explorer_full_mv_v2_bssid_uidx
  ON public.api_network_explorer_full_mv_v2 (bssid);

CREATE INDEX IF NOT EXISTS api_network_explorer_full_mv_v2_last_seen_idx
  ON public.api_network_explorer_full_mv_v2 (last_observed_at DESC, bssid);
CREATE INDEX IF NOT EXISTS api_network_explorer_full_mv_v2_ssid_idx
  ON public.api_network_explorer_full_mv_v2 (lower(ssid), bssid);
CREATE INDEX IF NOT EXISTS api_network_explorer_full_mv_v2_signal_idx
  ON public.api_network_explorer_full_mv_v2 (signal DESC, bssid);
CREATE INDEX IF NOT EXISTS api_network_explorer_full_mv_v2_obs_count_idx
  ON public.api_network_explorer_full_mv_v2 (obs_count DESC, bssid);
CREATE INDEX IF NOT EXISTS api_network_explorer_full_mv_v2_distance_idx
  ON public.api_network_explorer_full_mv_v2 (distance_from_home_km ASC, bssid);
