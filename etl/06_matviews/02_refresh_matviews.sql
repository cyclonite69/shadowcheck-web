\echo 'Refresh materialized views'

REFRESH MATERIALIZED VIEW mv_network_latest;
REFRESH MATERIALIZED VIEW mv_network_timeline;
REFRESH MATERIALIZED VIEW mv_heatmap_tiles;
REFRESH MATERIALIZED VIEW mv_device_routes;
