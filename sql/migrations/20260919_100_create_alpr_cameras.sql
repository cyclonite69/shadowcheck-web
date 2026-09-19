CREATE TABLE IF NOT EXISTS app.alpr_cameras (
  osm_id BIGINT PRIMARY KEY,
  geom geometry(Point, 4326) NOT NULL,
  source_properties JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alpr_cameras_geom_gist
  ON app.alpr_cameras USING GIST (geom);

CREATE INDEX IF NOT EXISTS idx_alpr_cameras_last_seen_desc
  ON app.alpr_cameras (last_seen DESC);

GRANT SELECT ON app.alpr_cameras TO shadowcheck_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON app.alpr_cameras TO shadowcheck_admin;
