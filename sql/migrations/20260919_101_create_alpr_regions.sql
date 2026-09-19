-- app.alpr_regions: durable per-metro sync outcome for ALPR/Overpass pipeline.
-- Seeded from the ALPR_REGIONS code constant (src/alpr/regions.ts).
-- bbox jsonb is [west, south, east, north] matching that constant.

CREATE TABLE IF NOT EXISTS app.alpr_regions (
  region_id          text PRIMARY KEY,
  name               text NOT NULL,
  state              text NOT NULL,
  bbox               jsonb NOT NULL,
  sync_status        text NOT NULL DEFAULT 'idle'
                     CHECK (sync_status IN ('idle', 'running', 'success', 'failed')),
  last_sync_at       timestamptz,
  last_chunk_count   int,
  last_element_count int,
  cooldown_until     timestamptz,
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alpr_regions_sync_status
  ON app.alpr_regions (sync_status);

CREATE INDEX IF NOT EXISTS idx_alpr_regions_last_sync_at
  ON app.alpr_regions (last_sync_at DESC NULLS LAST);

INSERT INTO app.alpr_regions (region_id, name, state, bbox)
VALUES
  ('nyc', 'New York City Metro', 'NY', '[-74.3, 40.5, -73.65, 41.0]'::jsonb),
  ('la', 'Los Angeles Metro', 'CA', '[-118.9, 33.6, -117.6, 34.4]'::jsonb),
  ('chicago', 'Chicago Metro', 'IL', '[-88.3, 41.5, -87.3, 42.2]'::jsonb),
  ('houston', 'Houston', 'TX', '[-95.8, 29.4, -95.0, 30.2]'::jsonb),
  ('phoenix', 'Phoenix', 'AZ', '[-112.4, 33.2, -111.6, 33.9]'::jsonb),
  ('philadelphia', 'Philadelphia', 'PA', '[-75.4, 39.8, -74.9, 40.2]'::jsonb),
  ('san-antonio', 'San Antonio', 'TX', '[-98.8, 29.2, -98.2, 29.7]'::jsonb),
  ('san-diego', 'San Diego', 'CA', '[-117.4, 32.5, -116.9, 33.1]'::jsonb),
  ('dfw', 'Dallas-Fort Worth', 'TX', '[-97.5, 32.5, -96.5, 33.2]'::jsonb),
  ('austin', 'Austin', 'TX', '[-98.0, 30.0, -97.5, 30.6]'::jsonb),
  ('dc', 'Washington DC Metro', 'DC', '[-77.6, 38.7, -76.7, 39.2]'::jsonb),
  ('baltimore', 'Baltimore', 'MD', '[-76.9, 39.1, -76.4, 39.5]'::jsonb),
  ('bay-area', 'San Francisco Bay Area', 'CA', '[-123.0, 37.1, -121.5, 38.3]'::jsonb),
  ('seattle', 'Seattle', 'WA', '[-122.6, 47.3, -121.9, 47.8]'::jsonb),
  ('denver', 'Denver', 'CO', '[-105.3, 39.5, -104.6, 40.0]'::jsonb),
  ('boston', 'Boston', 'MA', '[-71.4, 42.2, -70.8, 42.6]'::jsonb),
  ('detroit', 'Detroit', 'MI', '[-83.5, 42.1, -82.8, 42.6]'::jsonb),
  ('flint', 'Flint', 'MI', '[-83.95, 42.9, -83.65, 43.15]'::jsonb),
  ('atlanta', 'Atlanta', 'GA', '[-84.7, 33.5, -84.0, 34.1]'::jsonb),
  ('miami', 'Miami', 'FL', '[-80.5, 25.5, -80.0, 26.0]'::jsonb),
  ('minneapolis', 'Minneapolis-St Paul', 'MN', '[-93.5, 44.7, -92.9, 45.2]'::jsonb),
  ('portland', 'Portland', 'OR', '[-122.9, 45.3, -122.4, 45.7]'::jsonb),
  ('las-vegas', 'Las Vegas', 'NV', '[-115.4, 35.9, -114.9, 36.4]'::jsonb),
  ('charlotte', 'Charlotte', 'NC', '[-81.1, 35.0, -80.6, 35.5]'::jsonb),
  ('nashville', 'Nashville', 'TN', '[-87.0, 35.9, -86.5, 36.4]'::jsonb),
  ('columbus', 'Columbus', 'OH', '[-83.3, 39.7, -82.7, 40.2]'::jsonb),
  ('indianapolis', 'Indianapolis', 'IN', '[-86.4, 39.5, -85.9, 40.0]'::jsonb),
  ('st-louis', 'St. Louis', 'MO', '[-90.5, 38.4, -90.0, 38.9]'::jsonb),
  ('kansas-city', 'Kansas City', 'MO', '[-94.9, 38.8, -94.3, 39.4]'::jsonb),
  ('milwaukee', 'Milwaukee', 'WI', '[-88.2, 42.8, -87.7, 43.3]'::jsonb)
ON CONFLICT (region_id) DO NOTHING;

GRANT SELECT ON app.alpr_regions TO shadowcheck_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON app.alpr_regions TO shadowcheck_admin;
