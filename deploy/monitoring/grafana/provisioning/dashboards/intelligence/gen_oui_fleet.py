"""Dashboard 3 — OUI fleet intelligence."""
import json, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from gen_shared import *

# ── OUI fleet table (national) ─────────────────────────────────────────────────
SQL_OUI_NATIONAL = f"""SELECT
  left(upper(replace(v2.bssid,':','')),6) AS "OUI",
  COALESCE(rm.manufacturer, '⚠ Unregistered') AS "Manufacturer",
  COUNT(DISTINCT v2.region) AS "States",
  string_agg(DISTINCT v2.region, ', ' ORDER BY v2.region) AS "State List",
  CASE WHEN COUNT(DISTINCT v2.region) >= 30 THEN 'National fleet'
       WHEN COUNT(DISTINCT v2.region) >= 15 THEN 'Regional fleet'
       WHEN COUNT(DISTINCT v2.region) >= 5  THEN 'Multi-state'
       ELSE 'Local' END AS "Fleet Scope",
  COUNT(*) AS "Records",
  ROUND(GREATEST(0, AVG(EXTRACT(EPOCH FROM (v2.lasttime - v2.firsttime))/86400))) AS "Avg Span (d)"
FROM app.wigle_v2_networks_search v2
LEFT JOIN app.radio_manufacturers rm ON rm.prefix = left(upper(replace(v2.bssid,':','')),6) AND rm.bit_length = 24
WHERE v2.ssid ILIKE '%${{ssid_pattern}}%' AND v2.country = 'US'
  AND v2.trilat IS NOT NULL AND v2.trilong IS NOT NULL
GROUP BY left(upper(replace(v2.bssid,':','')),6), rm.manufacturer
HAVING COUNT(DISTINCT v2.region) >= 3
ORDER BY COUNT(DISTINCT v2.region) DESC"""

# ── Intra-state concentration (alias-safe) ─────────────────────────────────────
SQL_CONCENTRATION = f"""SELECT
  v2.region AS "State",
  COUNT(*) AS "Total records",
  COUNT(DISTINCT left(upper(replace(v2.bssid,':','')),6)) AS "Distinct OUIs",
  ROUND(COUNT(DISTINCT left(upper(replace(v2.bssid,':','')),6))::numeric / NULLIF(COUNT(*),0), 4) AS "Diversity ratio",
  (SELECT left(upper(replace(v2b.bssid,':','')),6)
   FROM app.wigle_v2_networks_search v2b
   WHERE v2b.ssid ILIKE '%${{ssid_pattern}}%' AND v2b.country='US' AND v2b.region=v2.region
     AND v2b.trilat IS NOT NULL AND v2b.trilong IS NOT NULL
   GROUP BY 1 ORDER BY COUNT(*) DESC LIMIT 1) AS "Dominant OUI",
  CASE
    WHEN ROUND(COUNT(DISTINCT left(upper(replace(v2.bssid,':','')),6))::numeric / NULLIF(COUNT(*),0), 4) < 0.10 THEN 'Fleet signal'
    WHEN ROUND(COUNT(DISTINCT left(upper(replace(v2.bssid,':','')),6))::numeric / NULLIF(COUNT(*),0), 4) < 0.30 THEN 'Moderate concentration'
    ELSE 'High diversity'
  END AS "Concentration class"
FROM app.wigle_v2_networks_search v2
WHERE v2.ssid ILIKE '%${{ssid_pattern}}%' AND v2.country = 'US'
  AND v2.trilat IS NOT NULL AND v2.trilong IS NOT NULL
  {STATE_FILTER}
GROUP BY v2.region
HAVING COUNT(*) >= 5
ORDER BY 4 ASC"""

# ── Missing v3 imports ─────────────────────────────────────────────────────────
SQL_MISSING_V3 = f"""WITH {base_cte(STATE_FILTER)},
{OUI_STATES_CTE},
{PROXIMITY_CTE},
classified AS (
  SELECT b.bssid, b.manufacturer, b.lasttime, b.span_days,
    p.min_dist_m, os.oui_state_count,
    {hw_class_case()} AS hw_class
  FROM base b JOIN proximity p ON p.bssid = b.bssid JOIN oui_states os ON os.oui_24 = b.oui_24
  WHERE NOT EXISTS (SELECT 1 FROM app.wigle_v3_network_details v3 WHERE v3.netid = b.bssid)
),
tiers AS (
  SELECT
    CASE hw_class
      WHEN 'mobile_command'    THEN '1 - Mobile command'
      WHEN 'fleet_vehicle'     THEN '2 - Fleet vehicle'
      WHEN 'residential_agent' THEN '3 - Residential agent'
      WHEN 'enterprise'        THEN '4 - Enterprise'
    END AS priority_tier,
    COUNT(*)::bigint            AS count_missing,
    ROUND(AVG(min_dist_m))      AS avg_dist_m,
    ROUND(AVG(span_days))       AS avg_span_d,
    MIN(lasttime)               AS oldest_last_seen,
    MAX(lasttime)               AS newest_last_seen
  FROM classified
  WHERE hw_class IN ('mobile_command','fleet_vehicle','residential_agent','enterprise')
  GROUP BY hw_class, priority_tier
)
SELECT priority_tier        AS "Priority tier",
       count_missing        AS "Count missing",
       avg_dist_m           AS "Avg dist (m)",
       avg_span_d           AS "Avg span (d)",
       oldest_last_seen     AS "Oldest last seen",
       newest_last_seen     AS "Newest last seen"
FROM tiers
UNION ALL
SELECT 'TOTAL',
       SUM(count_missing),
       ROUND(SUM(avg_dist_m * count_missing) / NULLIF(SUM(count_missing), 0)),
       ROUND(SUM(avg_span_d  * count_missing) / NULLIF(SUM(count_missing), 0)),
       MIN(oldest_last_seen),
       MAX(newest_last_seen)
FROM tiers
ORDER BY 1"""

# ── Text ───────────────────────────────────────────────────────────────────────
TEXT_OUI = """## OUI fleet fingerprint analysis

**4CD9C4 — Magneti Marelli (43 states)** is the single strongest genuine-agency OUI. Magneti Marelli manufactures automotive infotainment systems — specifically the WiFi chipsets embedded in government fleet vehicles. A 43-state spread is a procurement fingerprint, not coincidence.

**The automotive OUI tier** (Magneti Marelli, Mitsumi Electric, Alps Alpine, Panasonic Automotive, Visteon) represents OEM WiFi chipsets in fleet vehicle infotainment systems. They appear in vehicles, not buildings. Their presence near field offices indicates fleet vehicles parked in the vicinity.

**B20073 — Unregistered (34 states)**: No IEEE manufacturer registration. National spread with consistent office proximity. The Tacoma pair (`B2:00:73:5F:D5:E5/E6`) is the anchor record.

**oui_state_spread >= 30 as a procurement signal**: When an OUI appears in 30+ states, it indicates a national procurement contract — the same hardware purchased across all field offices simultaneously.

**v3 import gap**: Automotive OUIs have the highest national spread but the lowest v3 coverage. The bulk of existing v3 imports are enterprise-class hardware."""

panels = [
    table_panel(1, "National fleet OUI fingerprint", SQL_OUI_NATIONAL, x=0, y=0, w=24, h=12, overrides=[
        {"matcher": {"id": "byName", "options": "States"},
         "properties": [
             {"id": "custom.displayMode", "value": "color-background"},
             {"id": "thresholds", "value": {"mode": "absolute", "steps": [
                 {"color": "white", "value": None}, {"color": "light-green", "value": 3},
                 {"color": "green", "value": 15},   {"color": "dark-green", "value": 30},
             ]}},
         ]},
        {"matcher": {"id": "byName", "options": "Manufacturer"}, "properties": [{"id": "custom.width", "value": 280}]},
        {"matcher": {"id": "byName", "options": "State List"},    "properties": [{"id": "custom.width", "value": 400}]},
    ]),

    text_panel(2, "OUI fleet fingerprint analysis", TEXT_OUI, x=0, y=12, w=24, h=8),

    table_panel(3, "Intra-state OUI concentration — fleet procurement signal", SQL_CONCENTRATION,
                x=0, y=20, w=24, h=10, overrides=[
        {"matcher": {"id": "byName", "options": "Concentration class"},
         "properties": [{"id": "custom.displayMode", "value": "color-background"},
                        {"id": "mappings", "value": [{"type": "value", "options": {
                            "Fleet signal":           {"color": "#E85D24", "index": 0},
                            "Moderate concentration": {"color": "#FFA500", "index": 1},
                            "High diversity":         {"color": "gray",    "index": 2},
                        }}]}]},
        {"matcher": {"id": "byName", "options": "Diversity ratio"},
         "properties": [{"id": "custom.displayMode", "value": "color-background"},
                        {"id": "thresholds", "value": {"mode": "absolute", "steps": [
                            {"color": "#E85D24", "value": None},
                            {"color": "#FFA500", "value": 0.10},
                            {"color": "gray",    "value": 0.30},
                        ]}}]},
    ]),

    table_panel(4, "Missing v3 imports — by priority tier", SQL_MISSING_V3,
                x=0, y=30, w=24, h=10, overrides=[
        {"matcher": {"id": "byName", "options": "Count missing"},
         "properties": [{"id": "custom.displayMode", "value": "color-background"},
                        {"id": "thresholds", "value": {"mode": "absolute", "steps": [
                            {"color": "green", "value": None}, {"color": "#FFA500", "value": 1},
                        ]}}]},
    ]),
]

dashboard = dashboard_wrapper(
    "shadowcheck-oui-fleet",
    "ShadowCheck — OUI Fleet Intelligence",
    panels,
    "OUI procurement fingerprinting: national fleet spread, intra-state concentration, and v3 import gap analysis.",
)

out = os.path.join(os.path.dirname(__file__), "shadowcheck_oui_fleet.json")
with open(out, "w") as f:
    json.dump(dashboard, f, indent=2)
print(f"Written: {out}")
