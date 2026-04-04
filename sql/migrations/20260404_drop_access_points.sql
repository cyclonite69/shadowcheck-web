BEGIN;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'potential_cruft'
          AND table_name = 'access_points_orphans'
          AND column_name = 'id'
          AND column_default LIKE '%access_points_v2_id_seq%'
    ) THEN
        ALTER TABLE potential_cruft.access_points_orphans
            ALTER COLUMN id DROP DEFAULT;
    END IF;
END $$;

DROP VIEW IF EXISTS app.v_real_access_points;
DROP TABLE IF EXISTS app.access_points;
DROP SEQUENCE IF EXISTS app.access_points_v2_id_seq;

COMMIT;
