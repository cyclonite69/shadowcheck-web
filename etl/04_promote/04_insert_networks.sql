\echo 'Promote staging networks into networks fact table'

-- Deduplicate staging_networks, keeping the most recent observation per BSSID
WITH deduped AS (
  SELECT DISTINCT ON (bssid)
    bssid,
    ssid,
    type,
    frequency,
    capabilities,
    service,
    rcois,
    mfgrid,
    lasttime,
    lastlat,
    lastlon,
    bestlevel,
    bestlat,
    bestlon,
    device_id
  FROM staging_networks
  ORDER BY bssid, lasttime DESC
)
INSERT INTO public.networks (
  bssid, ssid, type, frequency, capabilities, service, rcois, mfgrid,
  lasttime_ms, lastlat, lastlon, bestlevel, bestlat, bestlon, source_device
)
SELECT
  bssid,
  COALESCE(ssid, '') AS ssid,
  type,
  frequency,
  capabilities,
  COALESCE(service, '') AS service,
  COALESCE(rcois, '') AS rcois,
  mfgrid,
  lasttime,
  lastlat,
  lastlon,
  bestlevel,
  bestlat,
  bestlon,
  device_id
FROM deduped
ON CONFLICT (bssid) DO UPDATE
SET ssid = EXCLUDED.ssid,
    type = EXCLUDED.type,
    frequency = EXCLUDED.frequency,
    capabilities = EXCLUDED.capabilities,
    service = EXCLUDED.service,
    rcois = EXCLUDED.rcois,
    mfgrid = EXCLUDED.mfgrid,
    lasttime_ms = EXCLUDED.lasttime_ms,
    lastlat = EXCLUDED.lastlat,
    lastlon = EXCLUDED.lastlon,
    bestlevel = EXCLUDED.bestlevel,
    bestlat = EXCLUDED.bestlat,
    bestlon = EXCLUDED.bestlon,
    source_device = EXCLUDED.source_device;
