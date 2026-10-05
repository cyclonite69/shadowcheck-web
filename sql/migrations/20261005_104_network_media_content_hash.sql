-- Migration: network_media_content_hash
-- Description: Ensure image_sha256 is correctly populated for all existing media
-- and create a trigger to automatically calculate it for new insertions/updates.
-- Rollback: DROP TRIGGER, DROP FUNCTION

BEGIN;

-- 1. Create the function that will compute the hash
CREATE OR REPLACE FUNCTION app.network_media_compute_hash_trigger()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculate SHA-256 hash of media_data and store as hex string
    IF NEW.media_data IS NOT NULL THEN
        NEW.image_sha256 := encode(sha256(NEW.media_data), 'hex');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Create the trigger on app.network_media
DROP TRIGGER IF EXISTS network_media_compute_hash ON app.network_media;
CREATE TRIGGER network_media_compute_hash
    BEFORE INSERT OR UPDATE OF media_data
    ON app.network_media
    FOR EACH ROW
    EXECUTE FUNCTION app.network_media_compute_hash_trigger();

-- 3. Backfill existing data
-- Note: This might take some time depending on the number and size of existing media rows.
UPDATE app.network_media
SET image_sha256 = encode(sha256(media_data), 'hex')
WHERE image_sha256 IS NULL OR image_sha256 != encode(sha256(media_data), 'hex');

COMMIT;
