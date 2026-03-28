"""Generate Ivy/fleet correlation and mobile unit intelligence dashboards."""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from gen_shared import (
    dashboard_wrapper,
    stat_panel,
    timeseries_panel,
    table_panel,
    geomap_panel,
    barchart_panel,
    text_panel,
    heatmap_panel,
)

HOME_RADIUS_M = 250
FLEET_START = "2025-10-18 20:29:54+00"
FLEET_END = "2025-10-18 20:30:41+00"
IVY_LAST = "2025-10-29 06:12:12+00"
OCT_START = "2025-10-01"
OCT_END = "2025-11-01"

HOME_CTE = f"""home AS (
  SELECT latitude, longitude
  FROM app.location_markers
  WHERE marker_type = 'home'
  LIMIT 1
)"""

IVY_FILTER = "UPPER(o.bssid) LIKE 'E2:DB:D1:1E:0C:B%' OR UPPER(o.bssid) LIKE 'E2:DB:D1:25:0C:B%'"
FLEET_FILTER = """(
  COALESCE(e.manufacturer,'') ILIKE '%Sierra Wireless%'
  OR COALESCE(e.manufacturer,'') ILIKE '%Air Link%'
  OR COALESCE(e.manufacturer,'') ILIKE '%Wnc%'
  OR COALESCE(e.manufacturer,'') ILIKE '%Aumovio%'
  OR COALESCE(e.manufacturer,'') ILIKE '%Lg Innotek%'
  OR COALESCE(e.ssid,'') ILIKE 'Hotspot%'
  OR COALESCE(e.ssid,'') ILIKE 'hum%'
  OR COALESCE(e.ssid,'') ILIKE 'myGMC%'
)"""

SIGNATURE_FILTER = """(
  UPPER(o.bssid) IN (
    '02:54:AF:F2:5F:7F','88:5A:85:8F:6A:82','88:5A:85:D9:65:74',
    '5A:E4:03:C8:0A:E8','00:54:AF:8E:C2:D2'
  )
  OR COALESCE(e.manufacturer,'') ILIKE '%Wnc%'
  OR COALESCE(e.manufacturer,'') ILIKE '%Aumovio%'
  OR COALESCE(e.manufacturer,'') ILIKE '%myGMC%'
  OR COALESCE(e.manufacturer,'') ILIKE '%T Mobile%'
  OR COALESCE(e.ssid,'') ILIKE 'myGMC%'
  OR COALESCE(e.ssid,'') ILIKE 'TMOBILE%'
)"""

def build_ivy_dashboard():
    ivy_cte = f"""{HOME_CTE},
ivy AS (
  SELECT
    o.time,
    o.bssid,
    COALESCE(e.manufacturer, '') AS manufacturer,
    COALESCE(e.security, '') AS security,
    o.lat,
    o.lon,
    o.level,
    ROUND(
      ST_Distance(
        ST_SetSRID(ST_MakePoint(o.lon, o.lat), 4326)::geography,
        ST_SetSRID(ST_MakePoint(h.longitude, h.latitude), 4326)::geography
      )::numeric,
      1
    ) AS dist_m
  FROM app.observations o
  CROSS JOIN home h
  LEFT JOIN app.api_network_explorer_mv e
    ON UPPER(e.bssid) = UPPER(o.bssid)
  WHERE o.lat IS NOT NULL
    AND o.lon IS NOT NULL
    AND ST_DWithin(
      ST_SetSRID(ST_MakePoint(o.lon, o.lat), 4326)::geography,
      ST_SetSRID(ST_MakePoint(h.longitude, h.latitude), 4326)::geography,
      {HOME_RADIUS_M}
    )
    AND ({IVY_FILTER})
    AND o.time >= '2024-10-01'
    AND o.time < '2025-11-01'
)"""

    timeline_cte = f"""{ivy_cte},
days AS (
  SELECT generate_series(
    (SELECT COALESCE(MIN(date_trunc('day', time)), TIMESTAMPTZ '2024-10-01') FROM ivy),
    (SELECT COALESCE(MAX(date_trunc('day', time)), TIMESTAMPTZ '2025-10-31') FROM ivy),
    INTERVAL '1 day'
  ) AS day
),
ivy_daily AS (
  SELECT date_trunc('day', time) AS day, COUNT(*) AS ivy_obs FROM ivy GROUP BY 1
),
fleet_daily AS (
  SELECT
    date_trunc('day', o.time) AS day,
    COUNT(*) AS fleet_obs
  FROM app.observations o
  CROSS JOIN home h
  LEFT JOIN app.api_network_explorer_mv e
    ON UPPER(e.bssid) = UPPER(o.bssid)
  WHERE o.lat IS NOT NULL
    AND o.lon IS NOT NULL
    AND ST_DWithin(
      ST_SetSRID(ST_MakePoint(o.lon, o.lat), 4326)::geography,
      ST_SetSRID(ST_MakePoint(h.longitude, h.latitude), 4326)::geography,
      {HOME_RADIUS_M}
    )
    AND ({FLEET_FILTER})
    AND o.time >= (SELECT MIN(time) FROM ivy)
    AND o.time <= (SELECT MAX(time) FROM ivy)
  GROUP BY 1
)
SELECT
  day AS \"time\",
  COALESCE(i.ivy_obs, 0) AS \"Ivy obs\",
  COALESCE(f.fleet_obs, 0) AS \"Home fleet obs\"
FROM days d
LEFT JOIN ivy_daily i ON i.day = d.day
LEFT JOIN fleet_daily f ON f.day = d.day
ORDER BY 1"""

    sql_manifest = f"""{ivy_cte}
SELECT
  bssid AS \"BSSID\",
  COALESCE(manufacturer, 'unknown') AS \"Manufacturer\",
  security AS \"Security\",
  MIN(time) AS \"First seen\",
  MAX(time) AS \"Last seen\",
  COUNT(*) AS \"Observations\",
  ROUND(AVG(level)::numeric, 1) AS \"Avg signal (dBm)\",
  ROUND(MIN(dist_m)::numeric, 1) AS \"Closest to home (m)\"
FROM ivy
GROUP BY bssid, manufacturer, security
ORDER BY MAX(time) DESC"""

    sql_unique = f"""{ivy_cte}
SELECT COUNT(DISTINCT bssid) AS \"Unique Ivy BSSIDs\" FROM ivy"""

    sql_days_diff = f"""{ivy_cte}
WITH ivy_span AS (
  SELECT MAX(time) AS last_seen FROM ivy
)
SELECT
  ROUND(EXTRACT(EPOCH FROM (TIMESTAMPTZ '{FLEET_START}' - last_seen)) / 86400::numeric, 2) AS \"Days difference\"
FROM ivy_span"""

    text_context = """## Ivy3737 disappearance + fleet overlay

- **Fleet anchor**: coordinated home burst happened on `2025-10-18 20:29:54+00`.
- **Ivy3737 last seen**: `2025-10-29 06:12:12+00`.
- **Interpretation tip**: negative days difference = fleet appeared before Ivy vanished (surveillance). Positive value = fleet came after (equipment removal)."""

    annotations = [
        {
            "name": "Fleet burst",
            "datasource": "shadowcheck-postgres",
            "enable": True,
            "iconColor": "#E85D24",
            "type": "query",
            "query": f"SELECT TIMESTAMPTZ '{FLEET_START}' AS time, 'Coordinated fleet at home' AS text",
            "text": "Coordinated fleet detection",
        },
        {
            "name": "Ivy last seen",
            "datasource": "shadowcheck-postgres",
            "enable": True,
            "iconColor": "#378ADD",
            "type": "query",
            "query": f"SELECT TIMESTAMPTZ '{IVY_LAST}' AS time, 'Ivy3737 final observation' AS text",
            "text": "Ivy3737 final observation",
        },
    ]

    panels = [
        text_panel(1, "Ivy3737 disappearance context", text_context, x=0, y=0, w=24, h=4),
        timeseries_panel(2, "Daily Ivy + fleet observations", timeline_cte, x=0, y=4, w=24, h=10),
        table_panel(3, "Ivy variants near home", sql_manifest, x=0, y=14, w=24, h=10),
        stat_panel(4, "Unique Ivy BSSIDs", sql_unique, "short", x=0, y=24, w=8, h=4),
        stat_panel(5, "Fleet → Ivy difference (days)", sql_days_diff, "days", x=8, y=24, w=8, h=4),
        text_panel(
            6,
            "Interpretation",
            "Negative difference: the fleet appeared before Ivy vanished (surveillance). Positive difference: fleet arrived after Ivy stopped broadcasting (removal/redeployment).",
            x=16,
            y=24,
            w=8,
            h=4,
        ),
    ]

    dashboard = dashboard_wrapper(
        "shadowcheck-ivy-disappearance-correlation",
        "ShadowCheck — Ivy3737 Disappearance & Fleet Correlation",
        panels,
        "Timeline of Ivy3737 observations near the home marker with the fleet anchor overlaid.",
        annotations=annotations,
    )
    path = os.path.join(os.path.dirname(__file__), "shadowcheck_ivy_disappearance_correlation.json")
    with open(path, "w") as f:
        json.dump(dashboard, f, indent=2)
    print("Written:", path)

SIGNATURE_BASE_CTE = f"""
WITH signature AS (
  SELECT
    o.time,
    o.lat,
    o.lon,
    o.bssid,
    COALESCE(e.ssid, o.ssid, '') AS ssid,
    COALESCE(e.manufacturer, 'unknown') AS manufacturer,
    COALESCE(e.region, 'Unknown') AS region
  FROM app.observations o
  LEFT JOIN app.api_network_explorer_mv e
    ON UPPER(e.bssid) = UPPER(o.bssid)
  WHERE o.lat IS NOT NULL
    AND o.lon IS NOT NULL
    AND {SIGNATURE_FILTER}
    AND o.time >= '2024-01-01'
)
"""

SIGNATURE_MOVEMENT_CTE = f"""{SIGNATURE_BASE_CTE},
ordered AS (
  SELECT
    *,
    LAG(lat) OVER (PARTITION BY bssid ORDER BY time) AS prev_lat,
    LAG(lon) OVER (PARTITION BY bssid ORDER BY time) AS prev_lon,
    LAG(time) OVER (PARTITION BY bssid ORDER BY time) AS prev_time
  FROM signature
),
movement AS (
  SELECT
    time,
    lat,
    lon,
    bssid,
    ssid,
    manufacturer,
    region,
    CASE WHEN prev_lat IS NOT NULL AND prev_lon IS NOT NULL THEN
      ROUND(
        ST_Distance(
          ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography,
          ST_SetSRID(ST_MakePoint(prev_lon, prev_lat), 4326)::geography
        )::numeric,
        1
      )
    END AS distance_m,
    CASE WHEN prev_time IS NOT NULL THEN
      ROUND(EXTRACT(EPOCH FROM (time - prev_time))::numeric, 1)
    END AS delta_s,
    CASE WHEN prev_lat IS NOT NULL AND prev_lon IS NOT NULL THEN
      DEGREES(
        ST_Azimuth(
          ST_SetSRID(ST_MakePoint(prev_lon, prev_lat), 4326)::geography,
          ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography
        )
      )
    END AS bearing_deg
  FROM ordered
),
movement_enriched AS (
  SELECT
    time,
    lat,
    lon,
    bssid,
    ssid,
    manufacturer,
    region,
    distance_m,
    delta_s,
    bearing_deg,
    CASE
      WHEN delta_s > 0 AND distance_m IS NOT NULL THEN ROUND(distance_m / delta_s::numeric, 2)
    END AS speed_m_s
  FROM movement
)
"""

def build_mobile_unit_dashboard():
    sql_map = f"""{SIGNATURE_MOVEMENT_CTE}
SELECT
  lat AS trilat,
  lon AS trilong,
  time,
  EXTRACT(EPOCH FROM time)::numeric AS time_epoch,
  bssid,
  ssid,
  manufacturer,
  region,
  distance_m,
  speed_m_s,
  bearing_deg
FROM movement_enriched
ORDER BY time DESC"""

    sql_state = f"""{SIGNATURE_BASE_CTE}
SELECT
  region AS state,
  COUNT(DISTINCT bssid) AS \"unique_locations\"
FROM signature
GROUP BY 1
ORDER BY 2 DESC"""

    sql_timeline = f"""{SIGNATURE_BASE_CTE}
SELECT
  date_trunc('week', time) AS time,
  COUNT(DISTINCT bssid) AS \"devices\"
FROM signature
GROUP BY 1
ORDER BY 1"""

    sql_locations = f"""{SIGNATURE_BASE_CTE}
SELECT COUNT(DISTINCT ROUND(lat::numeric, 4) || ':' || ROUND(lon::numeric, 4)) AS value
FROM signature"""

    sql_clusters = f"""{SIGNATURE_MOVEMENT_CTE}
SELECT
  date_trunc('hour', time) AS \"Window\",
  ROUND(lat::numeric, 4) AS \"Lat\",
  ROUND(lon::numeric, 4) AS \"Lon\",
  manufacturer AS \"Manufacturer\",
  region AS \"State\",
  COUNT(DISTINCT bssid) AS \"Unique BSSIDs\",
  ROUND(AVG(speed_m_s)::numeric, 2) AS \"Avg speed (m/s)\",
  ROUND(AVG(bearing_deg)::numeric, 1) AS \"Avg bearing\",
  ROUND(SUM(distance_m)::numeric, 1) AS \"Total distance (m)\",
  COUNT(*) AS \"Observations\"
FROM movement_enriched
GROUP BY 1,2,3,4,5
ORDER BY \"Window\" DESC
LIMIT 100"""

    panels = [
        text_panel(
            1,
            "Mobile unit signature - nationwide",
            "Map shows WNC/Aumovio/OnStar/T-Mobile clusters that match the home burst signature. "
            "Table highlights hourly clusters with bearing, speed, and distance.",
            x=0,
            y=0,
            w=24,
            h=3,
        ),
        geomap_panel(2, "Signature map (color = timestamp)", sql_map, x=0, y=3, w=16, h=16, zoom=4, color_field="time_epoch"),
        stat_panel(3, "Unique signature locations", sql_locations, "short", x=16, y=3, w=8, h=4),
        barchart_panel(4, "Unique locations by state", sql_state, x=16, y=7, w=8, h=6),
        timeseries_panel(5, "Weekly signature sightings", sql_timeline, x=0, y=19, w=16, h=8),
        table_panel(6, "Cluster motion stats", sql_clusters, x=16, y=13, w=8, h=14),
    ]

    dashboard = dashboard_wrapper(
        "shadowcheck-mobile-unit-nationwide",
        "ShadowCheck — Mobile Unit Signature (Nationwide)",
        panels,
        "National footprint of the coordinated WNC/Aumovio/OnStar/T-Mobile signature.",
    )
    path = os.path.join(os.path.dirname(__file__), "shadowcheck_mobile_unit_nationwide.json")
    with open(path, "w") as f:
        json.dump(dashboard, f, indent=2)
    print("Written:", path)

def build_oct_2025_dashboard():
    disappearances_cte = f"""
WITH disappearances AS (
  SELECT
    *,
    CASE
      WHEN UPPER(bssid) LIKE 'E2:DB:D1:1E:0C:B%' OR UPPER(bssid) LIKE 'E2:DB:D1:25:0C:B%' THEN 'Ivy3737'
      WHEN COALESCE(manufacturer, '') ILIKE '%Sierra Wireless%' THEN 'Sierra Wireless'
      WHEN COALESCE(manufacturer, '') ILIKE '%Air Link%' THEN 'Airlink'
      ELSE 'Other'
    END AS manufacturer_group,
    COALESCE(region, 'Unknown') AS state,
    date_trunc('day', last_seen) AS day
  FROM app.api_network_explorer_mv
  WHERE last_seen >= '{OCT_START}' AND last_seen < '{OCT_END}'
)
"""

    sql_stack = f"""{disappearances_cte}
SELECT day AS \"date\", manufacturer_group AS \"manufacturer\", COUNT(*) AS \"count\"
FROM disappearances
GROUP BY 1,2
ORDER BY 1,2"""

    sql_heatmap = f"""{disappearances_cte}
SELECT state, manufacturer_group AS manufacturer, COUNT(*) AS \"count\"
FROM disappearances
GROUP BY 1,2
ORDER BY 1,2"""

    sql_table = f"""{disappearances_cte}
SELECT
  bssid,
  ssid,
  manufacturer,
  security,
  state,
  ROUND(observations::numeric, 0) AS observations,
  ROUND(unique_locations::numeric, 0) AS unique_locations,
  first_seen,
  last_seen
FROM disappearances
ORDER BY last_seen DESC
LIMIT 200"""

    sql_metric = f"""{disappearances_cte}
SELECT COUNT(*) AS value FROM disappearances"""

    panels = [
        barchart_panel(1, "Devices disappeared Oct 2025", sql_stack, x=0, y=0, w=16, h=12, stacking="normal"),
        table_panel(2, "Oct 2025 disappearances", sql_table, x=16, y=0, w=8, h=12),
        heatmap_panel(3, "States × manufacturers (Oct 2025)", sql_heatmap, x=0, y=12, w=16, h=12),
        stat_panel(4, "Total Oct 2025 loss", sql_metric, "short", x=16, y=12, w=8, h=4),
        text_panel(
            5,
            "Assessment",
            "Do the peaks align across Ivy3737, Sierra Wireless, and Airlink? Use this heatmap to spot regional coordination.",
            x=16,
            y=16,
            w=8,
            h=8,
        ),
    ]

    dashboard = dashboard_wrapper(
        "shadowcheck-oct-2025-shutdowns",
        "ShadowCheck — October 2025 Infrastructure Disappearances",
        panels,
        "Stacked view of devices that vanished in October 2025 plus regional heatmap.",
    )
    path = os.path.join(os.path.dirname(__file__), "shadowcheck_oct_2025_shutdowns.json")
    with open(path, "w") as f:
        json.dump(dashboard, f, indent=2)
    print("Written:", path)


if __name__ == "__main__":
    build_ivy_dashboard()
    build_mobile_unit_dashboard()
    build_oct_2025_dashboard()
