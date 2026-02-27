-- Add missing indexes for radio filters
-- These should make radioTypes and frequencyBands filters instant

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_network_explorer_mv_type 
  ON app.api_network_explorer_mv(type);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_network_explorer_mv_frequency 
  ON app.api_network_explorer_mv(frequency);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_network_explorer_mv_channel 
  ON app.api_network_explorer_mv(channel);

-- Analyze to update statistics
ANALYZE app.api_network_explorer_mv;
