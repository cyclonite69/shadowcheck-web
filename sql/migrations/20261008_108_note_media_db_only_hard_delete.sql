BEGIN;

-- Rows already marked deleted represent completed deletion requests; remove
-- them and their attachments before removing the legacy soft-delete state.
DELETE FROM app.network_notes
WHERE is_deleted IS TRUE;

DROP VIEW IF EXISTS app.v_sibling_group_media;
DROP FUNCTION IF EXISTS app.delete_note_media(integer);
DROP FUNCTION IF EXISTS app.get_note_media(integer);
DROP INDEX IF EXISTS app.idx_network_notes_bssid_active;

ALTER TABLE app.network_notes
  DROP COLUMN IF EXISTS is_deleted;

ALTER TABLE app.note_media
  ALTER COLUMN media_data SET NOT NULL,
  DROP COLUMN IF EXISTS file_path,
  DROP COLUMN IF EXISTS storage_backend;

CREATE FUNCTION app.delete_note_media(media_id_param integer)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  deleted boolean;
BEGIN
  DELETE FROM app.note_media
  WHERE id = media_id_param
  RETURNING TRUE INTO deleted;
  RETURN COALESCE(deleted, FALSE);
END;
$$;

COMMENT ON FUNCTION app.delete_note_media(integer) IS 'Delete a note media record and return whether it existed';

CREATE FUNCTION app.get_note_media(note_id_param integer)
RETURNS TABLE(
  id integer,
  file_name character varying,
  file_size integer,
  media_type character varying,
  media_data bytea,
  mime_type character varying,
  created_at timestamp without time zone
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT nm.id, nm.file_name, nm.file_size, nm.media_type, nm.media_data, nm.mime_type, nm.created_at
  FROM app.note_media nm
  WHERE nm.note_id = note_id_param
  ORDER BY nm.created_at DESC;
END;
$$;

COMMENT ON FUNCTION app.get_note_media(integer) IS 'Retrieve database-resident media for a specific note';

DO $migration$
BEGIN
  IF to_regclass('app.mv_sibling_groups') IS NOT NULL THEN
    EXECUTE $view$
      CREATE VIEW app.v_sibling_group_media AS
      WITH group_members AS (
        SELECT
          s1.bssid AS member_bssid,
          s2.bssid AS sibling_bssid
        FROM app.mv_sibling_groups s1
        JOIN app.mv_sibling_groups s2 ON s1.group_id = s2.group_id
      )
      SELECT
        gm.member_bssid,
        nm.id,
        'media'::text AS record_type,
        nm.bssid AS source_bssid,
        nm.observation_id,
        nm.media_type,
        nm.filename,
        nm.file_size,
        nm.mime_type,
        nm.description,
        nm.exif_lat,
        nm.exif_lon,
        nm.exif_captured_at,
        nm.created_at,
        NULL::text AS note_content,
        NULL::text AS note_type
      FROM group_members gm
      JOIN app.network_media nm ON nm.bssid = gm.sibling_bssid
      WHERE nm.bssid != 'VISINT_UNMATCHED'

      UNION ALL

      SELECT
        gm.member_bssid,
        nn.id,
        'note'::text,
        nn.bssid AS source_bssid,
        NULL::bigint AS observation_id,
        NULL::text AS media_type,
        NULL::text AS filename,
        NULL::bigint AS file_size,
        NULL::text AS mime_type,
        NULL::text AS description,
        NULL::numeric AS exif_lat,
        NULL::numeric AS exif_lon,
        NULL::timestamptz AS exif_captured_at,
        nn.created_at,
        nn.content AS note_content,
        nn.note_type
      FROM group_members gm
      JOIN app.network_notes nn ON nn.bssid = gm.sibling_bssid
    $view$;
  END IF;
END
$migration$;

COMMIT;
