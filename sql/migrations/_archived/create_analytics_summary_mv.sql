-- Create materialized view for analytics to avoid real-time spatial calculations
-- This pre-computes common analytics aggregations for faster response times

DROP MATERIALIZED VIEW IF EXISTS public.analytics_summary_mv CASCADE;

CREATE MATERIALIZED VIEW public.analytics_summary_mv AS
WITH network_stats AS (
  SELECT 
    n.bssid,
    n.ssid,
    n.type,
    n.encryption,
    n.manufacturer,
    COUNT(l.id) as observation_count,
    MIN(l.time) as first_seen,
    MAX(l.time) as last_seen,
    AVG(l.signal) as avg_signal,
    MAX(l.signal) as max_signal,
    MIN(l.signal) as min_signal,
    COUNT(DISTINCT DATE(l.time)) as unique_days,
    ST_Centroid(ST_Collect(l.geom::geometry)) as centroid,
    CASE 
      WHEN COUNT(l.id) < 2 THEN NULL
      ELSE ROUND(
        LEAST(1, GREATEST(0,
          (1 - LEAST(MAX(ST_Distance(l.geom::geography, ST_Centroid(ST_Collect(l.geom::geometry))::geography)) / 500.0, 1)) * 0.5 +
          (1 - LEAST(EXTRACT(EPOCH FROM (MAX(l.time) - MIN(l.time))) / 3600 / 168, 1)) * 0.3 +
          LEAST(COUNT(l.id) / 50.0, 1) * 0.2
        ))::numeric, 3)
    END as stationary_confidence
  FROM app.networks_legacy n
  LEFT JOIN app.locations_legacy l ON n.bssid = l.bssid
  WHERE l.geom IS NOT NULL
  GROUP BY n.bssid, n.ssid, n.type, n.encryption, n.manufacturer
)
SELECT 
  ns.*,
  COALESCE(ne.threat, '{}'::jsonb) as threat,
  COALESCE(nts.threat_score, 0) as threat_score
FROM network_stats ns
LEFT JOIN public.api_network_explorer_mv ne ON UPPER(ne.bssid) = UPPER(ns.bssid)
LEFT JOIN app.network_threat_scores nts ON UPPER(nts.bssid) = UPPER(ns.bssid);

-- Create indexes for fast lookups
CREATE UNIQUE INDEX analytics_summary_mv_bssid_idx ON public.analytics_summary_mv (bssid);
CREATE INDEX analytics_summary_mv_type_idx ON public.analytics_summary_mv (type);
CREATE INDEX analytics_summary_mv_last_seen_idx ON public.analytics_summary_mv (last_seen DESC);
CREATE INDEX analytics_summary_mv_threat_score_idx ON public.analytics_summary_mv (threat_score DESC);

-- Refresh the materialized view
REFRESH MATERIALIZED VIEW public.analytics_summary_mv;

SELECT 'Analytics summary materialized view created successfully!' as status;
