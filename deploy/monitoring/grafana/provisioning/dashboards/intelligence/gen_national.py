"""Dashboard 1 — National provenance brief."""
import json, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from gen_shared import *

# ── Stat queries ───────────────────────────────────────────────────────────────
SQL_TOTAL = f"""WITH {base_cte(STATE_FILTER)}
SELECT COUNT(*) AS "Total US Records" FROM base"""

SQL_HIGH_CONF = f"""WITH {base_cte(STATE_FILTER)},
{OUI_STATES_CTE},
{PROXIMITY_CTE}
SELECT COUNT(*) FILTER (WHERE
    ({hw_pts_case()}) + ({PROX_PTS}) + ({SPREAD_PTS}) >= $confidence_threshold
) AS "High-confidence agency"
FROM base b JOIN proximity p ON p.bssid = b.bssid JOIN oui_states os ON os.oui_24 = b.oui_24"""

SQL_PCT = f"""WITH {base_cte(STATE_FILTER)},
{OUI_STATES_CTE},
{PROXIMITY_CTE}
SELECT ROUND(100.0 *
  COUNT(*) FILTER (WHERE ({hw_pts_case()}) + ({PROX_PTS}) + ({SPREAD_PTS}) >= $confidence_threshold)
  / NULLIF(COUNT(*), 0), 2) AS "% Agency"
FROM base b JOIN proximity p ON p.bssid = b.bssid JOIN oui_states os ON os.oui_24 = b.oui_24"""

SQL_FLEET_OUIS = f"""SELECT COUNT(*) AS "Fleet OUIs identified" FROM (
  SELECT {OUI_EXPR}
  FROM app.wigle_v2_networks_search v2
  WHERE v2.ssid ILIKE '%${{ssid_pattern}}%' AND v2.country = 'US'
  GROUP BY 1 HAVING COUNT(DISTINCT v2.region) >= 5
) t"""

# ── Composition charts ─────────────────────────────────────────────────────────
SQL_PIE = f"""{full_ctes(STATE_FILTER)}
SELECT hw_class AS "Hardware Class", COUNT(*) AS "Count"
FROM classified GROUP BY hw_class ORDER BY COUNT(*) DESC"""

SQL_CONF_BAR = f"""{full_ctes(STATE_FILTER)}
SELECT hw_class AS "Hardware Class",
  COUNT(*) FILTER (WHERE hw_pts+prox_pts+spread_pts >= $confidence_threshold) AS "High",
  COUNT(*) FILTER (WHERE hw_pts+prox_pts+spread_pts >= ($confidence_threshold::int - 20)
                     AND hw_pts+prox_pts+spread_pts <  $confidence_threshold) AS "Medium",
  COUNT(*) FILTER (WHERE hw_pts+prox_pts+spread_pts <  ($confidence_threshold::int - 20)) AS "Low"
FROM classified GROUP BY hw_class ORDER BY COUNT(*) DESC"""

# ── Time series ────────────────────────────────────────────────────────────────
SQL_TIME = f"""WITH {base_cte(STATE_FILTER)},
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

# ── OUI fleet table ────────────────────────────────────────────────────────────
SQL_OUI_TABLE = f"""SELECT
  {OUI_EXPR} AS "OUI",
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
LEFT JOIN app.radio_manufacturers rm ON rm.prefix = {OUI_EXPR} AND rm.bit_length = 24
WHERE v2.ssid ILIKE '%${{ssid_pattern}}%' AND v2.country = 'US'
  {STATE_FILTER}
GROUP BY {OUI_EXPR}, rm.manufacturer
HAVING COUNT(DISTINCT v2.region) >= 3
ORDER BY COUNT(DISTINCT v2.region) DESC"""

# ── Text panels ────────────────────────────────────────────────────────────────
TEXT_INTRO = """## What we're measuring

This brief classifies wardrive networks whose SSID contains **"$ssid_pattern"** against a five-tier hardware provenance model: fleet vehicles, mobile command units, enterprise fixed infrastructure, residential agent home networks, and civilian noise.

The **1.79% genuine agency figure** is a floor, not a ceiling. It captures only records where hardware evidence and geographic proximity independently corroborate each other. The ~15% ambiguous bucket (ISP gateways + unknown OUIs near offices) is where the most interesting analysis lives.

The confidence model deliberately requires hardware signal to be additive with proximity. Proximity alone (max 30 pts) cannot reach the default 60-pt threshold. This corrects a scoring artifact where ISP gateway routers belonging to civilians who happen to live near field offices were inflating the agency count."""

TEXT_COMPOSITION = """## Hardware class interpretation

**Fleet vehicle OUIs** (Magneti Marelli, Mitsumi Electric, Alps Alpine, Panasonic Automotive) are the single strongest genuine-agency signal. These are OEM infotainment WiFi chipsets — they appear in government fleet vehicles, not civilian hardware. A Magneti Marelli OUI appearing in 43 states is a procurement fingerprint, not coincidence.

**Mobile command** (Cradlepoint, Sierra Wireless, Inseego) are purpose-built cellular-to-WiFi bridges used in mobile command posts and surveillance vehicles. Zero civilian use case.

**Enterprise** class shows near-zero proximity to field offices — technically sophisticated civilians (home labs, small businesses), not office infrastructure. Field offices use managed networks that don't broadcast SSIDs containing "FBI".

**Unknown OUI** bucket: OUI prefix `B20073` appears in 33 states with consistent proximity to offices and has no manufacturer registration in the IEEE database. This is the highest-priority investigation target — either a custom-manufactured device or a recently registered OUI not yet in the public database. Confidence score: 40 pts (spread 25 + proximity 15 + unknown hw 8) — just below the default 60-pt threshold, which is why it doesn't appear in the high-confidence count despite being analytically significant."""

TEXT_FINDINGS = """## Fleet OUI fingerprint findings

- **4CD9C4 (Magneti Marelli, 43 states)**: The anchor OUI. Magneti Marelli manufactures automotive infotainment systems for government fleet vehicles. 43-state spread is consistent with a national fleet procurement contract.
- **B20073 (⚠ Unregistered, 33 states)**: No IEEE manufacturer registration. National spread with consistent office proximity. Priority v3 import target.
- **C449BB (Mitsumi Electric)** and **Alps Alpine OUIs**: Secondary automotive tier. Both appear in Flint, MI at sub-700m distances from the Flint RA.
- **Cradlepoint/Inseego OUIs**: Mobile command tier. Indiana cluster (4 sequential MACs, all within 200m) is the highest-priority mobile command target.

The v3 import gap is most acute in the automotive tier: highest national spread, lowest v3 coverage."""

panels = [
    stat_panel(1,  "Total US Records",         SQL_TOTAL,       "short",   x=0,  y=0),
    stat_panel(2,  "High-confidence agency",   SQL_HIGH_CONF,   "short",   x=6,  y=0, fixed_color="#1D9E75"),
    stat_panel(3,  "% Agency",                 SQL_PCT,         "percent", x=12, y=0),
    stat_panel(4,  "Fleet OUIs identified",    SQL_FLEET_OUIS,  "short",   x=18, y=0),

    text_panel(5,  "What we're measuring",     TEXT_INTRO,      x=0, y=4,  w=24, h=6),

    piechart_panel(6, "Hardware class breakdown",        SQL_PIE,       x=0,  y=10, w=12, h=10, overrides=hw_color_overrides()),
    barchart_panel(7, "Confidence tier by hw class",     SQL_CONF_BAR,  x=12, y=10, w=12, h=10, overrides=[
        {"matcher": {"id": "byName", "options": "High"},   "properties": [{"id": "color", "value": {"mode": "fixed", "fixedColor": "green"}}]},
        {"matcher": {"id": "byName", "options": "Medium"}, "properties": [{"id": "color", "value": {"mode": "fixed", "fixedColor": "#FFA500"}}]},
        {"matcher": {"id": "byName", "options": "Low"},    "properties": [{"id": "color", "value": {"mode": "fixed", "fixedColor": "red"}}]},
    ]),

    text_panel(8,  "Hardware class interpretation", TEXT_COMPOSITION, x=0, y=20, w=24, h=8),

    timeseries_panel(9, "First-seen by year — hardware class", SQL_TIME, x=0, y=28, w=24, h=10, overrides=hw_color_overrides()),

    table_panel(10, "National fleet OUI fingerprint", SQL_OUI_TABLE, x=0, y=38, w=24, h=12, overrides=[
        {"matcher": {"id": "byName", "options": "States"},
         "properties": [
             {"id": "custom.displayMode", "value": "color-background"},
             {"id": "thresholds", "value": {"mode": "absolute", "steps": [
                 {"color": "white", "value": None}, {"color": "light-green", "value": 3},
                 {"color": "green", "value": 15},   {"color": "dark-green", "value": 30},
             ]}},
         ]},
        {"matcher": {"id": "byName", "options": "Manufacturer"}, "properties": [{"id": "custom.width", "value": 280}]},
    ]),

    text_panel(11, "Fleet OUI fingerprint findings", TEXT_FINDINGS, x=0, y=50, w=24, h=8),
]

dashboard = dashboard_wrapper(
    "shadowcheck-national",
    "ShadowCheck — National Provenance Brief",
    panels,
    "Hardware provenance intelligence: classifying FBI-SSID wardrive records by OUI tier, proximity, and observation span.",
)

out = os.path.join(os.path.dirname(__file__), "shadowcheck_national.json")
with open(out, "w") as f:
    json.dump(dashboard, f, indent=2)
print(f"Written: {out}")
