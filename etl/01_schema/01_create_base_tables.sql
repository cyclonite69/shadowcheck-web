-- Base tables that persist across ETL runs.

CREATE TABLE IF NOT EXISTS device_sources (
  id serial PRIMARY KEY,
  code text UNIQUE NOT NULL,
  label text NOT NULL
);

INSERT INTO device_sources (code, label)
VALUES
  ('j24', 'J24 device'),
  ('g63', 'G63 device'),
  ('s22_main', 'S22 main export'),
  ('s22_backup', 'S22 backup export')
ON CONFLICT (code) DO NOTHING;
