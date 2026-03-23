"""Shared constants, CTEs, and panel builders for intelligence dashboards."""
import json

# ── Colors ─────────────────────────────────────────────────────────────────────
COLORS = {
    "fleet_vehicle":     "#E85D24",
    "mobile_command":    "#7F77DD",
    "enterprise":        "#1D9E75",
    "residential_agent": "#378ADD",
    "consumer":          "#888780",
    "other_isp_gateway": "#B4B2A9",
    "unknown_oui":       "#D4537E",
}

# ── Manufacturer match arrays ──────────────────────────────────────────────────
FLEET_ARR    = "ARRAY['%magneti marelli%','%panasonic automotive%','%visteon%','%harman/becker%','%mitsumi%','%alps alpine%','%alpsalpine%']"
MOBILE_ARR   = "ARRAY['%cradlepoint%','%sierra wireless%','%airlink%','%inseego%','%novatel%','%samsara%']"
ENTER_ARR    = "ARRAY['%cisco%','%aruba%','%ruckus%','%ubiquiti%','%meraki%','%fortinet%','%aerohive%','%juniper%']"
ISP_ARR      = "ARRAY['%arcadyan%','%pegatron%','%commscope%','%vantiva%','%sagemcom%','%askey%','%sercomm%','%gemtek%','%calix%']"
CONSUMER_ARR = "ARRAY['%netgear%','%tp-link%','%asus%','%linksys%','%belkin%','%d-link%','%zyxel%','%tenda%','%eero%','%google%','%amazon%']"

OUI_EXPR = "left(upper(replace(v2.bssid,':','')),6)"

# ── Reusable CASE blocks (use b.manufacturer — already in base CTE) ────────────
def hw_class_case(mfr="b.manufacturer"):
    return f"""CASE
      WHEN lower({mfr}) LIKE ANY({FLEET_ARR})    THEN 'fleet_vehicle'
      WHEN lower({mfr}) LIKE ANY({MOBILE_ARR})   THEN 'mobile_command'
      WHEN lower({mfr}) LIKE ANY({ENTER_ARR})    THEN 'enterprise'
      WHEN lower({mfr}) LIKE ANY({ISP_ARR})
           AND p.min_dist_m <= 2000 AND b.span_days >= ${{span_days_min}} THEN 'residential_agent'
      WHEN lower({mfr}) LIKE ANY({CONSUMER_ARR}) THEN 'consumer'
      WHEN lower({mfr}) LIKE ANY({ISP_ARR})      THEN 'other_isp_gateway'
      ELSE 'unknown_oui'
    END"""

def hw_class_num_case(mfr="b.manufacturer"):
    return f"""CASE
      WHEN lower({mfr}) LIKE ANY({FLEET_ARR})    THEN 1
      WHEN lower({mfr}) LIKE ANY({MOBILE_ARR})   THEN 2
      WHEN lower({mfr}) LIKE ANY({ENTER_ARR})    THEN 3
      WHEN lower({mfr}) LIKE ANY({ISP_ARR})
           AND p.min_dist_m <= 2000 AND b.span_days >= ${{span_days_min}} THEN 4
      WHEN lower({mfr}) LIKE ANY({CONSUMER_ARR}) THEN 5
      WHEN lower({mfr}) LIKE ANY({ISP_ARR})      THEN 6
      ELSE 7
    END"""

def hw_pts_case(mfr="b.manufacturer"):
    return f"""CASE
      WHEN lower({mfr}) LIKE ANY({FLEET_ARR})    THEN 45
      WHEN lower({mfr}) LIKE ANY({MOBILE_ARR})   THEN 45
      WHEN lower({mfr}) LIKE ANY({ENTER_ARR})    THEN 28
      WHEN lower({mfr}) LIKE ANY({CONSUMER_ARR}) THEN 4
      WHEN {mfr} IS NULL                         THEN 8
      ELSE 7
    END"""

PROX_PTS  = "CASE WHEN p.min_dist_m <= 1000 THEN 30 WHEN p.min_dist_m <= 5000 THEN 22 WHEN p.min_dist_m <= 25000 THEN 10 ELSE 0 END"
SPREAD_PTS = "CASE WHEN os.oui_state_count >= 30 THEN 25 WHEN os.oui_state_count >= 15 THEN 15 WHEN os.oui_state_count >= 5 THEN 7 ELSE 2 END"

# ── CTE builders ──────────────────────────────────────────────────────────────
def base_cte(extra_where=""):
    """base CTE — includes state filter in extra_where if needed."""
    return f"""base AS (
  SELECT
    v2.bssid, v2.ssid, v2.region, v2.city,
    v2.trilat, v2.trilong, v2.firsttime, v2.lasttime, v2.encryption,
    {OUI_EXPR} AS oui_24,
    rm.manufacturer,
    GREATEST(0, EXTRACT(EPOCH FROM (v2.lasttime - v2.firsttime))/86400) AS span_days
  FROM app.wigle_v2_networks_search v2
  LEFT JOIN app.radio_manufacturers rm
    ON rm.prefix = {OUI_EXPR} AND rm.bit_length = 24
  WHERE v2.ssid ILIKE '%${{ssid_pattern}}%'
    AND v2.country = 'US'
    AND v2.trilat IS NOT NULL
    {extra_where}
)"""

# State filter — ${state:csv} gives comma-separated values.
# Grafana sends "$__all" when "All" is selected, so we guard against that too.
# An empty string or the literal "$__all" means no state restriction.
STATE_FILTER = (
    "AND (\n    '${state:csv}' = '$__all'\n    OR v2.region = ANY(string_to_array('${state:csv}', ','))\n  )"
)

OUI_STATES_CTE = """oui_states AS (
  SELECT left(upper(replace(bssid,':','')),6) AS oui_24,
    COUNT(DISTINCT region) AS oui_state_count
  FROM app.wigle_v2_networks_search
  WHERE ssid ILIKE '%${ssid_pattern}%' AND country = 'US'
  GROUP BY 1
)"""

# Lateral proximity — uses base.trilat/trilong directly, no fan-out join
PROXIMITY_CTE = """proximity AS (
  SELECT b.bssid,
    ao.name AS nearest_office,
    ROUND(ST_Distance(
      ST_SetSRID(ST_MakePoint(b.trilong, b.trilat), 4326)::geography,
      ao.location
    )::numeric) AS min_dist_m
  FROM base b
  LEFT JOIN LATERAL (
    SELECT name, location FROM app.agency_offices
    WHERE location IS NOT NULL
    ORDER BY ST_SetSRID(ST_MakePoint(b.trilong, b.trilat), 4326)::geography <-> location LIMIT 1
  ) ao ON TRUE
)"""

def classified_cte(include_num=False):
    num_col = f",\n    {hw_class_num_case()} AS hw_class_num" if include_num else ""
    return f"""classified AS (
  SELECT b.*,
    p.min_dist_m, p.nearest_office, os.oui_state_count,
    {hw_class_case()} AS hw_class{num_col},
    {hw_pts_case()} AS hw_pts,
    {PROX_PTS} AS prox_pts,
    {SPREAD_PTS} AS spread_pts
  FROM base b
  JOIN proximity p ON p.bssid = b.bssid
  JOIN oui_states os ON os.oui_24 = b.oui_24
)"""

def full_ctes(extra_where="", include_num=False):
    return f"WITH {base_cte(extra_where)},\n{OUI_STATES_CTE},\n{PROXIMITY_CTE},\n{classified_cte(include_num)}"

# ── Datasource ref ─────────────────────────────────────────────────────────────
def ds():
    return {"type": "grafana-postgresql-datasource", "uid": "shadowcheck-postgres"}

# ── Panel builders ─────────────────────────────────────────────────────────────
def _base(pid, ptype, title, x, y, w, h):
    return {"id": pid, "type": ptype, "title": title, "gridPos": {"x": x, "y": y, "w": w, "h": h}}

def text_panel(pid, title, content, x, y, w, h):
    p = _base(pid, "text", title, x, y, w, h)
    p["options"] = {"mode": "markdown", "content": content}
    p["fieldConfig"] = {"defaults": {}, "overrides": []}
    return p

def _sql_target(sql, fmt="table"):
    return {"datasource": ds(), "rawSql": sql, "format": fmt, "refId": "A"}

def stat_panel(pid, title, sql, unit, x, y, w=6, h=4, fixed_color=None):
    p = _base(pid, "stat", title, x, y, w, h)
    p["datasource"] = ds()
    p["targets"] = [_sql_target(sql)]
    p["options"] = {
        "reduceOptions": {"calcs": ["last"], "fields": "", "values": False},
        "orientation": "auto", "textMode": "auto", "colorMode": "value",
    }
    fd = {"unit": unit, "mappings": [], "thresholds": {"mode": "absolute", "steps": [{"color": "green", "value": None}]}}
    if fixed_color:
        fd["color"] = {"mode": "fixed", "fixedColor": fixed_color}
    p["fieldConfig"] = {"defaults": fd, "overrides": []}
    return p

def table_panel(pid, title, sql, x, y, w, h, overrides=None):
    p = _base(pid, "table", title, x, y, w, h)
    p["datasource"] = ds()
    p["targets"] = [_sql_target(sql)]
    p["options"] = {"cellHeight": "sm", "showHeader": True, "sortBy": []}
    p["fieldConfig"] = {"defaults": {}, "overrides": overrides or []}
    return p

def timeseries_panel(pid, title, sql, x, y, w, h, overrides=None):
    p = _base(pid, "timeseries", title, x, y, w, h)
    p["datasource"] = ds()
    p["targets"] = [_sql_target(sql, "time_series")]
    p["options"] = {
        "tooltip": {"mode": "multi", "sort": "none"},
        "legend": {"displayMode": "list", "placement": "bottom", "showLegend": True},
    }
    p["fieldConfig"] = {
        "defaults": {"custom": {"lineWidth": 2, "fillOpacity": 10, "showPoints": "always"}},
        "overrides": overrides or [],
    }
    return p

def piechart_panel(pid, title, sql, x, y, w, h, overrides=None):
    p = _base(pid, "piechart", title, x, y, w, h)
    p["datasource"] = ds()
    p["targets"] = [_sql_target(sql)]
    p["options"] = {"pieType": "donut", "legend": {"displayMode": "list", "placement": "right", "showLegend": True}}
    p["fieldConfig"] = {"defaults": {}, "overrides": overrides or []}
    return p

def barchart_panel(pid, title, sql, x, y, w, h, stacking="none", overrides=None):
    p = _base(pid, "barchart", title, x, y, w, h)
    p["datasource"] = ds()
    p["targets"] = [_sql_target(sql)]
    p["options"] = {
        "stacking": stacking,
        "legend": {"displayMode": "list", "placement": "bottom", "showLegend": True},
        "tooltip": {"mode": "single", "sort": "none"},
    }
    p["fieldConfig"] = {"defaults": {}, "overrides": overrides or []}
    return p

def geomap_panel(pid, title, sql, x, y, w, h, lat=44.3, lng=-85.5, zoom=6):
    p = _base(pid, "geomap", title, x, y, w, h)
    p["datasource"] = ds()
    p["targets"] = [_sql_target(sql)]
    p["options"] = {
        "view": {"id": "coords", "lat": lat, "lon": lng, "zoom": zoom},
        "layers": [{
            "type": "markers", "name": "Networks", "tooltip": True,
            "config": {"size": {"fixed": 6}, "color": {"field": "hw_class_num"}},
            "location": {"mode": "coords", "latitude": "trilat", "longitude": "trilong"},
        }],
        "controls": {"showZoom": True, "mouseWheelZoom": True, "showAttribution": True},
        "tooltip": {"mode": "details"},
    }
    p["fieldConfig"] = {"defaults": {}, "overrides": []}
    return p

# ── Color overrides for hw_class series ───────────────────────────────────────
def hw_color_overrides():
    return [
        {"matcher": {"id": "byName", "options": cls},
         "properties": [{"id": "color", "value": {"mode": "fixed", "fixedColor": col}}]}
        for cls, col in COLORS.items()
    ]

# ── Variables ──────────────────────────────────────────────────────────────────
def variables():
    return [
        {
            "name": "ssid_pattern", "type": "textbox", "label": "SSID contains",
            "current": {"selected": True, "text": "FBI", "value": "FBI"},
            "query": "FBI", "hide": 0,
        },
        {
            "name": "state", "type": "query", "label": "State",
            "datasource": ds(),
            "query": "SELECT DISTINCT region FROM app.wigle_v2_networks_search WHERE ssid ILIKE '%${ssid_pattern}%' AND country = 'US' AND region IS NOT NULL ORDER BY region",
            "multi": True, "includeAll": True,
            "current": {"selected": True, "text": ["All"], "value": ["$__all"]},
            "refresh": 2, "hide": 0,
        },
        {
            "name": "confidence_threshold", "type": "custom", "label": "Min confidence score",
            "query": "40,50,60,70,80",
            "current": {"selected": True, "text": "60", "value": "60"},
            "options": [{"selected": v == 60, "text": str(v), "value": str(v)} for v in [40,50,60,70,80]],
            "hide": 0,
        },
        {
            "name": "span_days_min", "type": "custom", "label": "Min span (days)",
            "query": "90,180,365,730,1095",
            "current": {"selected": True, "text": "365", "value": "365"},
            "options": [{"selected": v == 365, "text": str(v), "value": str(v)} for v in [90,180,365,730,1095]],
            "hide": 0,
        },
    ]

# ── Dashboard wrapper ──────────────────────────────────────────────────────────
def dashboard_wrapper(uid, title, panels, description=""):
    return {
        "__inputs": [{"name": "DS_SHADOWCHECK_DB", "label": "shadowcheck_db",
                      "type": "datasource", "pluginId": "grafana-postgresql-datasource", "pluginName": "PostgreSQL"}],
        "__requires": [{"type": "datasource", "id": "grafana-postgresql-datasource", "name": "PostgreSQL", "version": "1.0.0"}],
        "uid": uid, "title": title, "description": description,
        "schemaVersion": 39, "version": 1,
        "time": {"from": "now-1y", "to": "now"},
        "timepicker": {}, "refresh": "", "liveNow": False,
        "tags": ["shadowcheck", "intelligence"],
        "templating": {"list": variables()},
        "panels": panels,
        "editable": True, "graphTooltip": 1, "links": [],
        "annotations": {"list": []},
    }
