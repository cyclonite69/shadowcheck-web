-- File: sql/add_note_media_schema.sql

CREATE TABLE IF NOT EXISTS app.note_media (
  id SERIAL PRIMARY KEY,
  note_id INTEGER NOT NULL REFERENCES app.network_notes(id) ON DELETE CASCADE,
  bssid VARCHAR(17) NOT NULL,
  file_path VARCHAR(512) NOT NULL,
  file_name VARCHAR(256) NOT NULL,
  file_size INTEGER,
  media_type VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (bssid) REFERENCES public.access_points(bssid) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_note_media_note_id ON app.note_media(note_id);
CREATE INDEX IF NOT EXISTS idx_note_media_bssid ON app.note_media(bssid);
CREATE INDEX IF NOT EXISTS idx_note_media_created ON app.note_media(created_at DESC);

CREATE OR REPLACE FUNCTION app.get_note_media(note_id_param INTEGER)
RETURNS TABLE (
  id INTEGER,
  file_path VARCHAR(512),
  file_name VARCHAR(256),
  file_size INTEGER,
  media_type VARCHAR(50),
  created_at TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  SELECT nm.id, nm.file_path, nm.file_name, nm.file_size, nm.media_type, nm.created_at
  FROM app.note_media nm
  WHERE nm.note_id = note_id_param
  ORDER BY nm.created_at DESC;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION app.delete_note_media(media_id_param INTEGER)
RETURNS VARCHAR(512) AS $$
DECLARE
  file_path VARCHAR(512);
BEGIN
  SELECT nm.file_path INTO file_path FROM app.note_media nm WHERE nm.id = media_id_param;
  DELETE FROM app.note_media WHERE id = media_id_param;
  RETURN file_path;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE app.note_media IS 'Media attachments for network notes';
COMMENT ON FUNCTION app.get_note_media IS 'Retrieve media for a specific note';
COMMENT ON FUNCTION app.delete_note_media IS 'Delete media and return file path';
