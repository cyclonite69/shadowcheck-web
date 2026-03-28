"""Dashboard — coordinated fleet detections near the home marker."""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from gen_shared import *

BURST_START = "2025-10-18 20:29:54+00"
BURST_END = "2025-10-18 20:30:41+00"
BURST_DAY = "2025-10-18 00:00:00+00"
HOME_RADIUS_M = 250

CLASS_CASE = """CASE
  WHEN COALESCE(e.manufacturer,'') ILIKE '%Wnc%' OR COALESCE(e.ssid,'') ILIKE 'hum%' THEN 'wnc'
  WHEN COALESCE(e.manufacturer,'') ILIKE '%Aumovio%' OR COALESCE(e.ssid,'') ILIKE 'Hotspot%' THEN 'aumovio_hotspot'
  WHEN COALESCE(e.manufacturer,'') ILIKE '%Sierra Wireless%' THEN 'sierra'
  WHEN COALESCE(e.manufacturer,'') ILIKE '%Air Link%' THEN 'airlink'
  WHEN COALESCE(e.ssid,'') ILIKE 'myGMC%' OR COALESCE(e.ssid,'') = 'myGMC' OR COALESCE(e.manufacturer,'') ILIKE '%Lg Innotek%' THEN 'gm'
  ELSE 'other'
END"""

CLASS_NUM_CASE = """CASE
  WHEN COALESCE(e.manufacturer,'') ILIKE '%Air Link%' THEN 1
  WHEN COALESCE(e.manufacturer,'') ILIKE '%Aumovio%' OR COALESCE(e.ssid,'') ILIKE 'Hotspot%' THEN 2
  WHEN COALESCE(e.ssid,'') ILIKE 'myGMC%' OR COALESCE(e.ssid,'') = 'myGMC' OR COALESCE(e.manufacturer,'') ILIKE '%Lg Innotek%' THEN 3
  WHEN COALESCE(e.manufacturer,'') ILIKE '%Wnc%' OR COALESCE(e.ssid,'') ILIKE 'hum%' THEN 4
  WHEN COALESCE(e.manufacturer,'') ILIKE '%Sierra Wireless%' THEN 5
  ELSE 6
END"""

RELEVANT_FILTER = """(
  COALESCE(e.manufacturer,'') ILIKE '%Sierra Wireless%'
  OR COALESCE(e.manufacturer,'') ILIKE '%Air Link%'
  OR COALESCE(e.manufacturer,'') ILIKE '%Wnc%'
  OR COALESCE(e.manufacturer,'') ILIKE '%Aumovio%'
  OR COALESCE(e.manufacturer,'') ILIKE '%Lg Innotek%'
  OR COALESCE(e.ssid,'') ILIKE 'Hotspot%'
  OR COALESCE(e.ssid,'') ILIKE 'hum%'
  OR COALESCE(e.ssid,'') ILIKE 'myGMC%'
)"""

HOME_CTE = f"""home AS (
  SELECT latitude, longitude
  FROM app.location_markers
  WHERE marker_type = 'home'
  LIMIT 1
)"""

BURST_CTE = f"""WITH
{HOME_CTE},
burst AS (
  SELECT
    o.time,
    o.lat AS trilat,
    o.lon AS trilong,
    o.bssid,
    COALESCE(e.ssid, o.ssid, '') AS ssid,
    COALESCE(e.manufacturer, '') AS manufacturer,
    COALESCE(e.security, '') AS security,
    o.level,
    ROUND(
      ST_Distance(
        ST_SetSRID(ST_MakePoint(o.lon, o.lat), 4326)::geography,
        ST_SetSRID(ST_MakePoint(h.longitude, h.latitude), 4326)::geography
      )::numeric,
      1
    ) AS dist_m,
    {CLASS_CASE} AS class,
    {CLASS_NUM_CASE} AS hw_class_num
  FROM app.observations o
  CROSS JOIN home h
  LEFT JOIN app.api_network_explorer_mv e
    ON e.bssid = o.bssid
  WHERE o.lat IS NOT NULL
    AND o.lon IS NOT NULL
    AND ST_DWithin(
      ST_SetSRID(ST_MakePoint(o.lon, o.lat), 4326)::geography,
      ST_SetSRID(ST_MakePoint(h.longitude, h.latitude), 4326)::geography,
      {HOME_RADIUS_M}
    )
    AND o.time BETWEEN TIMESTAMPTZ '{BURST_START}' AND TIMESTAMPTZ '{BURST_END}'
    AND {RELEVANT_FILTER}
)"""

RECUR_CTE = f"""WITH
{HOME_CTE},
rel AS (
  SELECT
    o.time,
    o.bssid,
    COALESCE(e.ssid, o.ssid, '') AS ssid,
    COALESCE(e.manufacturer, '') AS manufacturer,
    COALESCE(e.security, '') AS security,
    o.level,
    {CLASS_CASE} AS class
  FROM app.observations o
  CROSS JOIN home h
  LEFT JOIN app.api_network_explorer_mv e
    ON e.bssid = o.bssid
  WHERE o.lat IS NOT NULL
    AND o.lon IS NOT NULL
    AND ST_DWithin(
      ST_SetSRID(ST_MakePoint(o.lon, o.lat), 4326)::geography,
      ST_SetSRID(ST_MakePoint(h.longitude, h.latitude), 4326)::geography,
      {HOME_RADIUS_M}
    )
    AND {RELEVANT_FILTER}
)"""

SQL_BURST_TOTAL = f"""{BURST_CTE}
SELECT COUNT(DISTINCT bssid) AS "Distinct BSSIDs" FROM burst"""

SQL_BURST_DURATION = f"""{BURST_CTE}
SELECT ROUND(EXTRACT(EPOCH FROM (MAX(time) - MIN(time)))::numeric, 1) AS "Burst seconds" FROM burst"""

SQL_BURST_AVG = f"""{BURST_CTE}
SELECT ROUND(AVG(level)::numeric, 1) AS "Avg signal" FROM burst"""

SQL_BURST_MFR = f"""{BURST_CTE}
SELECT COUNT(DISTINCT manufacturer) FILTER (WHERE manufacturer <> '') AS "Manufacturers" FROM burst"""

SQL_GEOMAP = f"""{BURST_CTE}
SELECT
  trilat,
  trilong,
  hw_class_num,
  bssid,
  ssid,
  manufacturer,
  class,
  level,
  dist_m,
  time
FROM burst
ORDER BY time, bssid"""

SQL_MANIFEST = f"""{BURST_CTE}
SELECT
  bssid AS "BSSID",
  ssid AS "SSID",
  manufacturer AS "Manufacturer",
  security AS "Security",
  class AS "Class",
  MIN(time) AS "First seen",
  MAX(time) AS "Last seen",
  COUNT(*) AS "Observations",
  ROUND(AVG(level)::numeric, 1) AS "Avg signal",
  ROUND(MIN(dist_m)::numeric, 1) AS "Closest to home (m)"
FROM burst
GROUP BY bssid, ssid, manufacturer, security, class
ORDER BY MIN(time), bssid"""

SQL_SIGNAL = f"""{BURST_CTE}
SELECT
  time AS "time",
  MAX(level) FILTER (WHERE bssid = '00:54:AF:EB:EA:1A') AS "Aumovio HotspotEA1A",
  MAX(level) FILTER (WHERE bssid = 'F8:96:FE:5D:FA:ED') AS "GM 9780 ED",
  MAX(level) FILTER (WHERE bssid = 'F8:96:FE:5D:FA:EF') AS "GM 9780 EF",
  MAX(level) FILTER (WHERE bssid = '24:41:FE:57:6C:8E') AS "WNC Cheeto fingers",
  MAX(level) FILTER (WHERE bssid = '00:14:3E:9B:06:E0') AS "AirLink mdt",
  MAX(level) FILTER (WHERE bssid = '00:14:3E:9B:06:E1') AS "AirLink 801"
FROM burst
GROUP BY time
ORDER BY time"""

SQL_SAME_DAY_SIERRA = f"""WITH
{HOME_CTE}
SELECT
  o.time AS "Time",
  o.bssid AS "BSSID",
  COALESCE(e.ssid, o.ssid, '') AS "SSID",
  COALESCE(e.manufacturer, '') AS "Manufacturer",
  COALESCE(e.security, '') AS "Security",
  o.level AS "Signal",
  ROUND(
    ST_Distance(
      ST_SetSRID(ST_MakePoint(o.lon, o.lat), 4326)::geography,
      ST_SetSRID(ST_MakePoint(h.longitude, h.latitude), 4326)::geography
    )::numeric,
    1
  ) AS "Dist to home (m)"
FROM app.observations o
CROSS JOIN home h
LEFT JOIN app.api_network_explorer_mv e
  ON e.bssid = o.bssid
WHERE o.lat IS NOT NULL
  AND o.lon IS NOT NULL
  AND ST_DWithin(
    ST_SetSRID(ST_MakePoint(o.lon, o.lat), 4326)::geography,
    ST_SetSRID(ST_MakePoint(h.longitude, h.latitude), 4326)::geography,
    {HOME_RADIUS_M}
  )
  AND date_trunc('day', o.time) = TIMESTAMPTZ '{BURST_DAY}'
  AND COALESCE(e.manufacturer, '') ILIKE '%Sierra Wireless%'
ORDER BY o.time"""

SQL_TOP_WINDOWS = f"""{RECUR_CTE}
, windows AS (
  SELECT
    date_trunc('minute', time) AS minute_bucket,
    MIN(time) AS first_seen,
    MAX(time) AS last_seen,
    ROUND(EXTRACT(EPOCH FROM (MAX(time) - MIN(time)))::numeric, 1) AS span_s,
    COUNT(*) AS obs_count,
    COUNT(DISTINCT bssid) AS bssid_count,
    COUNT(DISTINCT class) AS class_count,
    STRING_AGG(DISTINCT class, ',' ORDER BY class) AS classes
  FROM rel
  GROUP BY 1
)
SELECT
  minute_bucket AS "Window",
  first_seen AS "First seen",
  last_seen AS "Last seen",
  span_s AS "Span (s)",
  obs_count AS "Obs",
  bssid_count AS "BSSIDs",
  class_count AS "Classes",
  classes AS "Class mix"
FROM windows
WHERE class_count >= 3
ORDER BY class_count DESC, bssid_count DESC, obs_count DESC, first_seen DESC
LIMIT 25"""

SQL_CLASS_SUMMARY = f"""{RECUR_CTE}
SELECT
  class AS "Class",
  COUNT(*) AS "Obs",
  COUNT(DISTINCT bssid) AS "Distinct BSSIDs",
  COUNT(DISTINCT date_trunc('day', time)) AS "Active days",
  MIN(time) AS "First seen",
  MAX(time) AS "Last seen"
FROM rel
GROUP BY class
ORDER BY COUNT(DISTINCT date_trunc('day', time)) DESC, COUNT(DISTINCT bssid) DESC"""

SQL_DAILY_CLASSES = f"""{RECUR_CTE}
SELECT
  date_trunc('day', time) AS "time",
  COUNT(DISTINCT bssid) FILTER (WHERE class = 'airlink') AS "airlink",
  COUNT(DISTINCT bssid) FILTER (WHERE class = 'aumovio_hotspot') AS "aumovio_hotspot",
  COUNT(DISTINCT bssid) FILTER (WHERE class = 'gm') AS "gm",
  COUNT(DISTINCT bssid) FILTER (WHERE class = 'sierra') AS "sierra",
  COUNT(DISTINCT bssid) FILTER (WHERE class = 'wnc') AS "wnc"
FROM rel
GROUP BY 1
ORDER BY 1"""

SQL_IVY_OVERLAY = f"""WITH
{HOME_CTE},
ivy_span AS (
  SELECT MIN(time) AS ivy_first, MAX(time) AS ivy_last
  FROM app.observations
  WHERE bssid LIKE 'E2:DB:D1:1E:0C:B%'
     OR bssid LIKE 'E2:DB:D1:25:0C:B%'
),
ivy_daily AS (
  SELECT date_trunc('day', time) AS day, COUNT(*) AS ivy_obs
  FROM app.observations
  WHERE bssid LIKE 'E2:DB:D1:1E:0C:B%'
     OR bssid LIKE 'E2:DB:D1:25:0C:B%'
  GROUP BY 1
),
fleet_daily AS (
  SELECT
    date_trunc('day', o.time) AS day,
    COUNT(*) AS home_fleet_obs,
    COUNT(*) FILTER (WHERE COALESCE(e.manufacturer, '') ILIKE '%Air Link%') AS airlink_obs,
    COUNT(*) FILTER (WHERE COALESCE(e.manufacturer, '') ILIKE '%Sierra Wireless%') AS sierra_obs
  FROM app.observations o
  CROSS JOIN home h
  CROSS JOIN ivy_span i
  LEFT JOIN app.api_network_explorer_mv e
    ON e.bssid = o.bssid
  WHERE o.lat IS NOT NULL
    AND o.lon IS NOT NULL
    AND ST_DWithin(
      ST_SetSRID(ST_MakePoint(o.lon, o.lat), 4326)::geography,
      ST_SetSRID(ST_MakePoint(h.longitude, h.latitude), 4326)::geography,
      {HOME_RADIUS_M}
    )
    AND o.time BETWEEN i.ivy_first AND i.ivy_last
    AND {RELEVANT_FILTER}
  GROUP BY 1
),
days AS (
  SELECT generate_series(
    (SELECT date_trunc('day', ivy_first) FROM ivy_span),
    (SELECT date_trunc('day', ivy_last) FROM ivy_span),
    INTERVAL '1 day'
  ) AS day
)
SELECT
  day AS "time",
  COALESCE(i.ivy_obs, 0) AS "ivy_obs",
  COALESCE(f.home_fleet_obs, 0) AS "home_fleet_obs",
  COALESCE(f.airlink_obs, 0) AS "airlink_obs",
  COALESCE(f.sierra_obs, 0) AS "sierra_obs"
FROM days d
LEFT JOIN ivy_daily i ON i.day = d.day
LEFT JOIN fleet_daily f ON f.day = d.day
ORDER BY 1"""

TEXT_CONTEXT = """## Coordinated fleet detection at the home marker

This dashboard anchors on the strongest verified mixed burst near the home marker:

- **Burst window**: `2025-10-18 20:29:54+00` to `2025-10-18 20:30:41+00`
- **Burst span**: `47 seconds`
- **Relevant radios in-window**: `6` distinct BSSIDs across `Aumovio`, `LG Innotek / GM`, `WNC`, and `Air Link`
- **Signal range**: roughly `-94 dBm` to `-66 dBm`
- **Distance from home marker**: approximately `86.5m` to `123.7m`

The database **does not** show Sierra Wireless inside this exact 47-second slice. It **does** show Sierra repeatedly at the same home location and on the same day (`2025-10-18`) later that evening, so the dashboard separates the confirmed burst from same-day contractor recurrence.

Interpretation: the data supports **repeated mixed mobile/contractor activity near home**, with one clean short-duration burst and many repeat passes. It does **not**, by itself, prove surveillance purpose.
"""

TEXT_FINDINGS = """## What the database supports

- **Ivy3737 lifecycle**: `2024-10-03 18:35:26+00` to `2025-10-29 06:12:12+00`
- **Burst vs Ivy end**: the anchor burst happens about **10.40 days before** Ivy's final observation
- **Air Link during Ivy lifetime**: `919` home-near observations across `119` active days
- **Sierra during Ivy lifetime**: `104` home-near observations across `37` active days
- **Same-day Sierra on burst day**: `2025-10-18 23:09:17+00` to `23:09:47+00`, roughly `9.6m` from home

Use the recurrence panels below to distinguish:

1. **Exact burst evidence** in the 47-second window
2. **Same-day same-location Sierra recurrence**
3. **Longer-lived repeat home visits** by Air Link, Aumovio/Hotspot, GM, Sierra, and WNC classes
"""

TEXT_NAV = """<center>
[← Michigan Intelligence](shadowcheck-michigan) | [America Fleet Patterns](shadowcheck-national) | [Home Fleet Detection](shadowcheck-home-fleet-detection) | [Contractor/OUI](shadowcheck-oui-fleet)
</center>
"""

panels = [
    text_panel(1, "Detection Context", TEXT_CONTEXT, x=0, y=0, w=24, h=8),
    stat_panel(2, "Burst BSSIDs", SQL_BURST_TOTAL, "short", x=0, y=8, fixed_color="#E85D24"),
    stat_panel(3, "Burst seconds", SQL_BURST_DURATION, "s", x=6, y=8),
    stat_panel(4, "Avg signal", SQL_BURST_AVG, "dBm", x=12, y=8),
    stat_panel(5, "Manufacturers", SQL_BURST_MFR, "short", x=18, y=8),
    geomap_panel(6, "Home burst map", SQL_GEOMAP, x=0, y=12, w=10, h=13, lat=43.02345147, lng=-83.69682688, zoom=15),
    table_panel(7, "Burst equipment manifest", SQL_MANIFEST, x=10, y=12, w=14, h=13),
    timeseries_panel(8, "Burst signal timeline", SQL_SIGNAL, x=0, y=25, w=24, h=10),
    table_panel(9, "Same-day Sierra sightings", SQL_SAME_DAY_SIERRA, x=0, y=35, w=10, h=8),
    table_panel(10, "Top mixed home windows", SQL_TOP_WINDOWS, x=10, y=35, w=14, h=8),
    text_panel(11, "Ivy Correlation", TEXT_FINDINGS, x=0, y=43, w=24, h=7),
    timeseries_panel(12, "Home class activity by day", SQL_DAILY_CLASSES, x=0, y=50, w=24, h=10),
    timeseries_panel(13, "Ivy vs home fleet activity", SQL_IVY_OVERLAY, x=0, y=60, w=24, h=10),
    table_panel(14, "Home recurrence by class", SQL_CLASS_SUMMARY, x=0, y=70, w=24, h=10),
    text_panel(15, "Navigate dashboards", TEXT_NAV, x=0, y=80, w=24, h=2),
]

dashboard = dashboard_wrapper(
    "shadowcheck-home-fleet-detection",
    "ShadowCheck — Coordinated Fleet Detection at Home",
    panels,
    "Home-location burst and recurrence dashboard for Aumovio, Air Link, WNC, GM, and Sierra patterns.",
)

out = os.path.join(os.path.dirname(__file__), "shadowcheck_home_fleet_detection.json")
with open(out, "w") as f:
    json.dump(dashboard, f, indent=2)
print(f"Written: {out}")
