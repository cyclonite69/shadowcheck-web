\echo 'Ensure spatial indexes and helpers exist'

-- Access point spatial index (add a geom column first if/when available).
-- CREATE INDEX IF NOT EXISTS idx_access_points_geom ON access_points USING GIST (geom);

-- Observations GIST index is handled separately; keep placeholder here for future spatial views.
