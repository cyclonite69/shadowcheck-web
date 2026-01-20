-- Refresh materialized view with improved security parsing
-- This fixes the "Unknown" security type issue for modern WiFi standards

REFRESH MATERIALIZED VIEW CONCURRENTLY public.api_network_explorer_mv;
