-- Store note attachment payloads directly in Postgres (bytea)

BEGIN;

ALTER TABLE app.note_media
  ADD COLUMN IF NOT EXISTS media_data bytea,
  ADD COLUMN IF NOT EXISTS mime_type varchar(255),
  ADD COLUMN IF NOT EXISTS storage_backend varchar(16) NOT NULL DEFAULT 'db';

-- Backfill existing rows to explicit backend where possible
UPDATE app.note_media
SET storage_backend = COALESCE(storage_backend, CASE WHEN media_data IS NOT NULL THEN 'db' ELSE 'file' END)
WHERE storage_backend IS NULL OR storage_backend = '';

-- Ensure new rows default to DB-backed storage
ALTER TABLE app.note_media
  ALTER COLUMN storage_backend SET DEFAULT 'db';

CREATE INDEX IF NOT EXISTS idx_note_media_note_id_created
  ON app.note_media (note_id, created_at DESC);

COMMENT ON COLUMN app.note_media.media_data IS
'Raw attachment payload stored in Postgres (bytea).';

COMMENT ON COLUMN app.note_media.storage_backend IS
'Storage backend indicator: db (bytea) or file (legacy path).';

COMMIT;
