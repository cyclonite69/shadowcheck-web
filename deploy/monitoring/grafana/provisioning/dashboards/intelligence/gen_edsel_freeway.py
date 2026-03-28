"""Grafana generator for Edsel Ford Freeway traffic intelligence."""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from gen_shared import (
    dashboard_wrapper,
    geomap_panel,
    stat_panel,
    table_panel,
    timeseries_panel,
    barchart_panel,
    text_panel,
)

OBS_WINDOW = "12 hours"
EDSEL_CTE = f"""WITH
edsel_obs AS (
  SELECT
    o.id,
    o.bssid,
    o.time,
    o.lat,
    o.lon,
    o.level,
    COALESCE(e.manufacturer, 'unknown') AS manufacturer,
    COALESCE(e.security, 'unknown') AS security
  FROM app.observations o
  LEFT JOIN app.api_network_explorer_mv e
    ON UPPER(e.bssid) = UPPER(o.bssid)
  WHERE o.lat BETWEEN 42.28 AND 42.34
    AND o.lon BETWEEN -83.22 AND -83.05
    AND o.time >= now() - INTERVAL '{OBS_WINDOW}'
),
ranked AS (
  SELECT
    *,
    ROW_NUMBER() OVER (PARTITION BY bssid ORDER BY time ASC) AS seq_start,
    ROW_NUMBER() OVER (PARTITION BY bssid ORDER BY time DESC) AS seq_end
  FROM edsel_obs
),
first_points AS (
  SELECT bssid, lat AS start_lat, lon AS start_lon, time AS start_time
  FROM ranked
  WHERE seq_start = 1
),
last_points AS (
  SELECT bssid, lat AS end_lat, lon AS end_lon, time AS end_time
  FROM ranked
  WHERE seq_end = 1
),
vehicle_summary_base AS (
  SELECT
    f.bssid,
    f.start_time,
    l.end_time,
    EXTRACT(EPOCH FROM (l.end_time - f.start_time)) AS duration_s,
    ROUND(
      ST_Distance(
        ST_SetSRID(ST_MakePoint(f.start_lon, f.start_lat), 4326)::geography,
        ST_SetSRID(ST_MakePoint(l.end_lon, l.end_lat), 4326)::geography
      )::numeric,
      1
    ) AS distance_m,
    f.start_lat,
    f.start_lon,
    l.end_lat,
    l.end_lon
  FROM first_points f
  JOIN last_points l USING (bssid)
),
vehicle_summary AS (
  SELECT
    *,
    CASE
      WHEN duration_s > 0 THEN ROUND((distance_m / 1609.34) / (duration_s / 3600), 1)
    END AS speed_mph
  FROM vehicle_summary_base
),
vehicle_meta AS (
  SELECT
    bssid,
    COALESCE(MAX(NULLIF(manufacturer, '')), 'unknown') AS manufacturer,
    COALESCE(MAX(NULLIF(security, '')), 'unknown') AS security,
    ROUND(AVG(level)::numeric, 1) AS avg_signal,
    COUNT(*) AS observation_count
  FROM edsel_obs
  GROUP BY bssid
)
"""

SQL_MAP = f"""{EDSEL_CTE}
SELECT
  vs.bssid,
  vs.start_lat,
  vs.start_lon,
  vs.end_lat,
  vs.end_lon,
  vs.speed_mph,
  CASE
    WHEN vs.speed_mph >= 50 THEN 'fast'
    WHEN vs.speed_mph >= 30 THEN 'medium'
    ELSE 'slow'
  END AS speed_class,
  ROUND(vs.distance_m::numeric, 1) AS distance_m,
  ROUND(vs.duration_s::numeric, 1) AS duration_s
FROM vehicle_summary vs
ORDER BY vs.speed_mph DESC NULLS LAST"""

SQL_SPEED_HIST = f"""{EDSEL_CTE}
SELECT
  CONCAT(bin_start, '-', bin_start + 5) AS "speed_range",
  COUNT(*) AS "vehicles",
  ROUND(MIN(speed_mph)::numeric, 1) AS "min_speed",
  ROUND(MAX(speed_mph)::numeric, 1) AS "max_speed"
FROM (
  SELECT
    *,
    FLOOR(speed_mph / 5) * 5 AS bin_start
  FROM vehicle_summary
  WHERE speed_mph IS NOT NULL
) s
GROUP BY bin_start
ORDER BY bin_start"""

SQL_SPEED_STATS = f"""{EDSEL_CTE}
SELECT
  ROUND(MIN(speed_mph)::numeric, 1) AS "Min speed",
  ROUND(MAX(speed_mph)::numeric, 1) AS "Max speed",
  ROUND(AVG(speed_mph)::numeric, 1) AS "Mean speed",
  ROUND(COALESCE(STDDEV(speed_mph), 0)::numeric, 1) AS "Std dev"
FROM vehicle_summary
WHERE speed_mph IS NOT NULL"""

SQL_VEHICLE_TABLE = f"""{EDSEL_CTE}
SELECT
  vs.bssid AS "BSSID",
  COALESCE(vm.manufacturer, 'unknown') AS "Manufacturer",
  COALESCE(vm.security, 'unknown') AS "Security",
  vs.start_time AS "Start time",
  vs.end_time AS "End time",
  ROUND(vs.distance_m::numeric, 1) AS "Distance (m)",
  ROUND(vs.duration_s::numeric, 1) AS "Duration (s)",
  ROUND(vs.speed_mph::numeric, 1) AS "Speed (mph)",
  vm.avg_signal AS "Avg signal (dBm)",
  vm.observation_count AS "Observations"
FROM vehicle_summary vs
LEFT JOIN vehicle_meta vm USING (bssid)
ORDER BY vs.speed_mph DESC NULLS LAST, vs.distance_m DESC"""

SQL_EQUIPMENT = f"""{EDSEL_CTE}
SELECT
  COALESCE(vm.manufacturer, 'unknown') AS "Manufacturer",
  COALESCE(vm.security, 'unknown') AS "Security",
  COUNT(*) AS "Vehicles",
  ROUND(AVG(vm.avg_signal)::numeric, 1) AS "Avg signal"
FROM vehicle_meta vm
GROUP BY vm.manufacturer, vm.security
ORDER BY "Vehicles" DESC"""

SQL_TIMELINE_COUNT = f"""{EDSEL_CTE}
SELECT
  date_trunc('minute', time) AS "time",
  COUNT(DISTINCT bssid) AS "Vehicles",
  COUNT(*) AS "Observations"
FROM edsel_obs
GROUP BY 1
ORDER BY 1"""

SQL_VEHICLES_PER_MIN = f"""{EDSEL_CTE}
SELECT
  ROUND(COUNT(DISTINCT bssid)::numeric / GREATEST(EXTRACT(EPOCH FROM (MAX(time) - MIN(time))) / 60, 1), 2) AS "Vehicles / min",
  ROUND(COUNT(*)::numeric / GREATEST(COUNT(DISTINCT bssid), 1), 2) AS "Obs / vehicle"
FROM edsel_obs"""

SQL_TOTAL_OBS = f"""{EDSEL_CTE}
SELECT COUNT(*) AS "Total observations" FROM edsel_obs"""

SQL_TOTAL_VEHICLES = f"""{EDSEL_CTE}
SELECT COUNT(DISTINCT bssid) AS "Unique vehicles" FROM vehicle_summary"""

SQL_OBS_TIMELINE = f"""{EDSEL_CTE}
SELECT
  o.time AS "time",
  o.lat AS "Latitude",
  vs.speed_mph AS "Speed"
FROM edsel_obs o
LEFT JOIN vehicle_summary vs USING (bssid)
ORDER BY o.time"""

TEXT_CONTEXT = f"""## Edsel Ford Freeway vehicle traffic snapshot
- **Area**: lat 42.28…42.34, lon -83.22…-83.05 (Edsel Ford Freeway corridor)
- **Time window**: last {OBS_WINDOW}
- **Goal**: translate BSSID detections into fast/medium/slow vehicle trajectories with equipment context.
"""

LINE_LAYER = {
    "type": "lines",
    "name": "Vehicle paths",
    "tooltip": True,
    "config": {
        "color": {"field": "speed_mph"},
        "colorScale": {"type": "linear", "min": 0, "max": 80, "color": ["#2e7d32", "#fdd835", "#c62828"]},
        "size": {"fixed": 4},
    },
    "location": {
        "mode": "coords",
        "latitudeStart": "start_lat",
        "longitudeStart": "start_lon",
        "latitudeEnd": "end_lat",
        "longitudeEnd": "end_lon",
    },
}

panels = [
    text_panel(1, "Freeway context", TEXT_CONTEXT, x=0, y=0, w=24, h=3),
    stat_panel(2, "Unique vehicles", SQL_TOTAL_VEHICLES, "short", x=0, y=3, w=6, h=3),
    stat_panel(3, "Total observations", SQL_TOTAL_OBS, "short", x=6, y=3, w=6, h=3),
    stat_panel(4, "Vehicles / min & Obs / vehicle", SQL_VEHICLES_PER_MIN, "short", x=12, y=3, w=6, h=3),
    geomap_panel(
        5,
        "Vehicle trajectories (color=speed)",
        SQL_MAP,
        x=0,
        y=6,
        w=16,
        h=16,
        lat=42.31,
        lng=-83.155,
        zoom=13,
        color_field="speed_mph",
        extra_layers=[LINE_LAYER],
    ),
    barchart_panel(6, "Speed distribution (mph)", SQL_SPEED_HIST, x=16, y=6, w=8, h=8),
    table_panel(7, "Speed summary", SQL_SPEED_STATS, x=16, y=14, w=8, h=6),
    timeseries_panel(8, "Vehicle detections per minute", SQL_TIMELINE_COUNT, x=0, y=22, w=16, h=8),
    table_panel(9, "Vehicle trajectories", SQL_VEHICLE_TABLE, x=16, y=22, w=8, h=10),
    table_panel(10, "Equipment manifest", SQL_EQUIPMENT, x=0, y=30, w=16, h=8),
    timeseries_panel(11, "Observation timeline (lat vs time)", SQL_OBS_TIMELINE, x=16, y=32, w=8, h=6),
]

dashboard = dashboard_wrapper(
    "shadowcheck-edsel-freeway-traffic",
    "ShadowCheck — Edsel Ford Freeway Vehicle Traffic Analysis",
    panels,
    "Trajectories, speed trends, and equipment breakdown for BSSIDs detected along the Edsel Ford Freeway.",
)

out = os.path.join(os.path.dirname(__file__), "shadowcheck_edsel_freeway_traffic.json")
with open(out, "w") as f:
    json.dump(dashboard, f, indent=2)
print(f"Written: {out}")
