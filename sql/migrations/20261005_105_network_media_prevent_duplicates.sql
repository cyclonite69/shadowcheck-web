-- Migration: network_media_prevent_duplicates
-- Description: Enforces global uniqueness of new media content using an advisory-locked trigger.
-- This allows the application to start even if legacy duplicates exist, while preventing new duplicates
-- from being created concurrently. A static UNIQUE constraint can be added in a future migration
-- once all legacy duplicates are resolved by operators.

BEGIN;

CREATE OR REPLACE FUNCTION app.network_media_prevent_duplicate_trigger()
RETURNS TRIGGER AS $$
DECLARE
    hash_int bigint;
    existing_id bigint;
BEGIN
    IF NEW.image_sha256 IS NULL THEN
        RETURN NEW;
    END IF;

    -- Generate a stable 64-bit integer from the first 16 hex chars of the sha256 for the advisory lock
    hash_int := ('x' || substr(NEW.image_sha256, 1, 16))::bit(64)::bigint;

    -- Acquire a transaction-level advisory lock based on the hash to prevent concurrent duplicate inserts
    PERFORM pg_advisory_xact_lock(hash_int);

    -- Check if a record with this hash already exists
    IF TG_OP = 'UPDATE' THEN
        SELECT id INTO existing_id FROM app.network_media WHERE image_sha256 = NEW.image_sha256 AND id != NEW.id LIMIT 1;
    ELSE
        SELECT id INTO existing_id FROM app.network_media WHERE image_sha256 = NEW.image_sha256 LIMIT 1;
    END IF;

    IF existing_id IS NOT NULL THEN
        RAISE unique_violation USING MESSAGE = 'duplicate key value violates unique constraint', DETAIL = 'Key (image_sha256)=(' || NEW.image_sha256 || ') already exists.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER network_media_prevent_duplicate
BEFORE INSERT OR UPDATE ON app.network_media
FOR EACH ROW
EXECUTE FUNCTION app.network_media_prevent_duplicate_trigger();

COMMIT;
