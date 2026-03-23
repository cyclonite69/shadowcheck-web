"""Dashboard 2 — Michigan intelligence brief."""
import json, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from gen_shared import *

MI_WHERE = "AND v2.region = 'MI'"

# ── Stats ──────────────────────────────────────────────────────────────────────
SQL_MI_TOTAL = f"""WITH {base_cte(MI_WHERE)}
SELECT COUNT(*) AS "MI Records" FROM base"""

SQL_MI_AGENTS = f"""WITH {base_cte(MI_WHERE)},
{PROXIMITY_CTE}
SELECT COUNT(*) AS "Residential agents"
FROM base b JOIN proximity p ON p.bssid = b.bssid
WHERE lower(b.manufacturer) LIKE ANY({ISP_ARR})
  AND p.min_dist_m <= 2000 AND b.span_days >= $span_days_min"""

SQL_MI_AVG_SPAN = f"""WITH {base_cte(MI_WHERE)},
{PROXIMITY_CTE}
SELECT ROUND(AVG(b.span_days)) AS "Avg span (days)"
FROM base b JOIN proximity p ON p.bssid = b.bssid
WHERE lower(b.manufacturer) LIKE ANY({ISP_ARR})
  AND p.min_dist_m <= 2000 AND b.span_days >= $span_days_min"""

SQL_MI_ACTIVE = f"""WITH {base_cte(MI_WHERE)}
SELECT COUNT(*) AS "Active (90d)" FROM base
WHERE lasttime >= NOW() - INTERVAL '90 days'"""

# ── Geomap ─────────────────────────────────────────────────────────────────────
SQL_GEOMAP = f"""{full_ctes(MI_WHERE, include_num=True)}
SELECT c.trilat, c.trilong, c.hw_class_num,
  COALESCE(c.manufacturer, 'Unknown') AS manufacturer,
  COALESCE(NULLIF(c.city,''), '(unknown)') AS city,
  c.nearest_office, c.min_dist_m AS dist_m,
  ROUND(c.span_days) AS span_days
FROM classified c
WHERE c.trilat BETWEEN 41.5 AND 48.3
  AND c.trilong BETWEEN -90.5 AND -82.1"""

# ── City heatmap ───────────────────────────────────────────────────────────────
SQL_CITY = f"""{full_ctes(MI_WHERE)}
SELECT
  COALESCE(NULLIF(city,''), '(unknown)') AS "City",
  COUNT(*) AS "Total",
  COUNT(DISTINCT oui_24) AS "Distinct OUIs",
  ROUND(AVG(min_dist_m)) AS "Avg dist (m)",
  ROUND(MIN(min_dist_m)) AS "Closest (m)",
  COUNT(*) FILTER (WHERE min_dist_m <= 2000) AS "Within 2km",
  COUNT(*) FILTER (WHERE span_days >= 365) AS "Multi-year",
  ROUND(AVG(span_days)) AS "Avg span (d)",
  COUNT(*) FILTER (WHERE hw_class = 'fleet_vehicle') AS "Fleet veh",
  COUNT(*) FILTER (WHERE hw_class = 'mobile_command') AS "Mobile cmd",
  COUNT(*) FILTER (WHERE hw_class = 'enterprise') AS "Enterprise",
  COUNT(*) FILTER (WHERE hw_class = 'residential_agent') AS "Res. agent",
  MAX(lasttime) AS "Last seen"
FROM classified
GROUP BY COALESCE(NULLIF(city,''), '(unknown)')
HAVING COUNT(*) >= 2
ORDER BY COUNT(*) DESC"""

# ── Proximity bands ────────────────────────────────────────────────────────────
SQL_PROX = f"""{full_ctes(MI_WHERE)}
SELECT
  CASE
    WHEN min_dist_m <= 500   THEN '1 — 0–500m'
    WHEN min_dist_m <= 1000  THEN '2 — 500m–1km'
    WHEN min_dist_m <= 2000  THEN '3 — 1–2km'
    WHEN min_dist_m <= 5000  THEN '4 — 2–5km'
    WHEN min_dist_m <= 25000 THEN '5 — 5–25km'
    ELSE                          '6 — >25km'
  END AS "Distance band",
  COUNT(*) AS "All records",
  COUNT(*) FILTER (WHERE span_days >= 365) AS "Multi-year span",
  COUNT(*) FILTER (WHERE hw_pts+prox_pts+spread_pts >= $confidence_threshold) AS "High-conf agency",
  COUNT(*) FILTER (WHERE hw_class = 'enterprise') AS "Enterprise",
  COUNT(*) FILTER (WHERE hw_class IN ('residential_agent','other_isp_gateway')) AS "ISP gateway"
FROM classified GROUP BY 1 ORDER BY 1"""

# ── Temporal ───────────────────────────────────────────────────────────────────
SQL_TIME = f"""WITH {base_cte(MI_WHERE)},
{OUI_STATES_CTE},
{PROXIMITY_CTE},
classified AS (
  SELECT b.firsttime, {hw_class_case()} AS hw_class
  FROM base b JOIN proximity p ON p.bssid = b.bssid JOIN oui_states os ON os.oui_24 = b.oui_24
  WHERE b.firsttime >= '2002-01-01'
)
SELECT date_trunc('year', firsttime) AS "time",
  COUNT(*) FILTER (WHERE hw_class='fleet_vehicle')     AS "fleet_vehicle",
  COUNT(*) FILTER (WHERE hw_class='mobile_command')    AS "mobile_command",
  COUNT(*) FILTER (WHERE hw_class='enterprise')        AS "enterprise",
  COUNT(*) FILTER (WHERE hw_class='residential_agent') AS "residential_agent",
  COUNT(*) FILTER (WHERE hw_class='consumer')          AS "consumer",
  COUNT(*) FILTER (WHERE hw_class='other_isp_gateway') AS "other_isp_gateway",
  COUNT(*) FILTER (WHERE hw_class='unknown_oui')       AS "unknown_oui"
FROM classified GROUP BY 1 ORDER BY 1"""

# ── High-value records ─────────────────────────────────────────────────────────
SQL_HVR = f"""{full_ctes(MI_WHERE, include_courthouse=True)}
SELECT
  c.bssid AS "BSSID",
  COALESCE(c.manufacturer, '⚠ Unknown') AS "Manufacturer",
  COALESCE(NULLIF(c.city,''), '—') AS "City",
  c.min_dist_m AS "Dist (m)",
  c.nearest_office AS "Nearest office",
  cp.courthouse_dist_m AS "Courthouse dist (m)",
  cp.nearest_courthouse AS "Nearest courthouse",
  cp.courthouse_district AS "District",
  ROUND(c.span_days) AS "Span (days)",
  c.firsttime AS "First seen",
  c.lasttime AS "Last seen",
  c.oui_state_count AS "OUI states",
  c.encryption AS "Enc",
  CASE WHEN v3.netid IS NOT NULL THEN 'YES' ELSE 'no' END AS "v3?"
FROM classified c
LEFT JOIN courthouse_proximity cp ON cp.bssid = c.bssid
LEFT JOIN app.wigle_v3_network_details v3 ON v3.netid = c.bssid
WHERE c.min_dist_m <= 2000
   OR lower(c.manufacturer) LIKE ANY({FLEET_ARR})
   OR lower(c.manufacturer) LIKE ANY({MOBILE_ARR})
   OR (c.span_days >= 365 AND c.min_dist_m <= 5000)
ORDER BY
  CASE c.hw_class
    WHEN 'mobile_command'    THEN 1
    WHEN 'fleet_vehicle'     THEN 2
    WHEN 'residential_agent' THEN 3
    WHEN 'enterprise'        THEN 4
    ELSE 5
  END, c.min_dist_m ASC, c.span_days DESC"""

# ── Text panels ────────────────────────────────────────────────────────────────
TEXT_CONTEXT = """## The residential agent hypothesis

Agents live near field offices. When an agent names their home WiFi network "FBI" — whether as a joke, a deterrent, or genuine carelessness — that network becomes a persistent signal in wardrive databases. The key insight is that **ISP gateway hardware** (Commscope, PEGATRON, Vantiva, Sagemcom) is what distinguishes a genuine home network from a mobile or enterprise deployment.

**Paired BSSID pattern**: Sequential MAC addresses with identical observation spans indicate a dual-band router — two radios, one household. The Tacoma pair (`B2:00:73:5F:D5:E5` / `B2:00:73:5F:D5:E6`) is the anchor example: still active as of March 2026, 1,305-day observation span, 580m from the Seattle Field Office.

**eero mesh cluster pattern**: Three nodes with sequential MACs (`30:57:8E:11:9B:46/47/48`), same SSID, same observation span — one household. The Grand Rapids cluster was active 2024–2026, sub-2km from the Grand Rapids RA."""

TEXT_FINDINGS = """## Michigan findings

**Flint** has the highest proximity hit rate of any named Michigan city: 42.6% of Flint records fall within 2km of the Flint RA.

- `B2:00:73:xx:xx:xx` (OUI B20073, ⚠ Unregistered): appears **twice** in Flint at 267m and 719m. 33-state national spread. Highest-priority unregistered OUI in the dataset.
- `C4:49:BB:xx:xx:xx` (Mitsumi Electric): Flint, 646m, 2,328-day span. Should be reclassified as `fleet_vehicle`.

**PEGATRON pair** (Flint): Two sequential MACs at 2,664m and 2,751m — just outside the 2km threshold. 2,709-day span (7.4 years). Residential agent candidates despite the distance miss.

**eero mesh cluster** (`30:57:8E:11:9B:46/47/48`): Three nodes, one household, Grand Rapids. Active 2024–2026. Sub-2km from Grand Rapids RA."""

TEXT_V3 = """## v3 import recommendations

### Tier 1 — Mobile command (immediate priority)
- **Indiana Inseego quad**: 4 sequential MACs, all within 200m, WPA3, last active Feb–Dec 2025.

### Tier 2 — Fleet vehicle
- **Phoenix Magneti Marelli** (`4C:D9:C4:xx:xx:xx`): 8,807-day span (24 years). Longest in dataset.
- **El Paso CradlePoint**: Active January 2026, within 500m of El Paso FO.

### Tier 3 — Residential agent
- **Tacoma pair** (`B2:00:73:5F:D5:E5` / `B2:00:73:5F:D5:E6`): Active March 2026. 1,305-day span. 580m from Seattle FO.
- **Omaha pair**: Active March 2026. 235m and 258m from Omaha FO.
- **Paducah**: Active January 2026. 477m from Paducah RA.

**Total targeted imports: approximately 25–30 BSSIDs**, prioritized above the bulk enterprise backlog."""

panels = [
    text_panel(1,  "The residential agent hypothesis", TEXT_CONTEXT, x=0, y=0,  w=24, h=8),

    stat_panel(2,  "MI Records",         SQL_MI_TOTAL,    "short", x=0,  y=8),
    stat_panel(3,  "Residential agents", SQL_MI_AGENTS,   "short", x=6,  y=8, fixed_color="#378ADD"),
    stat_panel(4,  "Avg agent span",     SQL_MI_AVG_SPAN, "d",     x=12, y=8),
    stat_panel(5,  "Active (90d)",       SQL_MI_ACTIVE,   "short", x=18, y=8),

    geomap_panel(6, "Michigan network map", SQL_GEOMAP, x=0,  y=12, w=12, h=14),
    table_panel(7,  "City heatmap",         SQL_CITY,   x=12, y=12, w=12, h=14, overrides=[
        {"matcher": {"id": "byName", "options": "Within 2km"},
         "properties": [{"id": "custom.displayMode", "value": "color-background"},
                        {"id": "thresholds", "value": {"mode": "absolute", "steps": [
                            {"color": "white", "value": None}, {"color": "light-green", "value": 1},
                            {"color": "green", "value": 10},   {"color": "dark-green", "value": 20},
                        ]}}]},
        {"matcher": {"id": "byName", "options": "Res. agent"},
         "properties": [{"id": "custom.displayMode", "value": "color-background"},
                        {"id": "thresholds", "value": {"mode": "absolute", "steps": [
                            {"color": "gray", "value": None}, {"color": "green", "value": 1},
                        ]}}]},
        {"matcher": {"id": "byName", "options": "Closest (m)"},
         "properties": [{"id": "custom.displayMode", "value": "color-background"},
                        {"id": "thresholds", "value": {"mode": "absolute", "steps": [
                            {"color": "green", "value": None}, {"color": "#FFA500", "value": 5000},
                            {"color": "transparent", "value": 25000},
                        ]}}]},
        {"matcher": {"id": "byName", "options": "Last seen"},
         "properties": [{"id": "custom.displayMode", "value": "color-background"},
                        {"id": "thresholds", "value": {"mode": "absolute", "steps": [
                            {"color": "red", "value": None}, {"color": "#FFA500", "value": -31536000},
                            {"color": "green", "value": -7776000},
                        ]}}]},
    ]),

    text_panel(8,  "Michigan findings",          TEXT_FINDINGS, x=0, y=26, w=24, h=8),
    barchart_panel(9, "Proximity band distribution", SQL_PROX, x=0, y=34, w=24, h=10),
    timeseries_panel(10, "Michigan first-seen by year — hardware class", SQL_TIME,
                     x=0, y=44, w=24, h=10, overrides=hw_color_overrides()),

    table_panel(11, "High-value records", SQL_HVR, x=0, y=54, w=24, h=12, overrides=[
        {"matcher": {"id": "byName", "options": "v3?"},
         "properties": [{"id": "custom.displayMode", "value": "color-background"},
                        {"id": "mappings", "value": [{"type": "value", "options": {
                            "YES": {"color": "green", "index": 0},
                            "no":  {"color": "gray",  "index": 1},
                        }}]}]},
        {"matcher": {"id": "byName", "options": "Last seen"},
         "properties": [{"id": "custom.displayMode", "value": "color-background"},
                        {"id": "thresholds", "value": {"mode": "absolute", "steps": [
                            {"color": "red", "value": None}, {"color": "#FFA500", "value": -31536000},
                            {"color": "green", "value": -7776000},
                        ]}}]},
    ]),

    text_panel(12, "v3 import recommendations", TEXT_V3, x=0, y=66, w=24, h=10),
]

dashboard = dashboard_wrapper(
    "shadowcheck-michigan",
    "ShadowCheck — Michigan Intelligence Brief",
    panels,
    "Residential agent identification and high-value record analysis for Michigan.",
)

out = os.path.join(os.path.dirname(__file__), "shadowcheck_michigan.json")
with open(out, "w") as f:
    json.dump(dashboard, f, indent=2)
print(f"Written: {out}")
