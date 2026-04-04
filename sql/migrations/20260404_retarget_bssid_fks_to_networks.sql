BEGIN;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM app.observations o
        WHERE NOT EXISTS (
            SELECT 1
            FROM app.networks n
            WHERE n.bssid = o.bssid
        )
    ) THEN
        RAISE EXCEPTION 'Cannot retarget observations FK: some bssids are missing from app.networks';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM app.note_media nm
        WHERE NOT EXISTS (
            SELECT 1
            FROM app.networks n
            WHERE n.bssid = nm.bssid
        )
    ) THEN
        RAISE EXCEPTION 'Cannot retarget note_media FK: some bssids are missing from app.networks';
    END IF;

    IF to_regclass('app.ssid_history') IS NOT NULL AND EXISTS (
        SELECT 1
        FROM app.ssid_history sh
        WHERE NOT EXISTS (
            SELECT 1
            FROM app.networks n
            WHERE n.bssid = sh.bssid
        )
    ) THEN
        RAISE EXCEPTION 'Cannot retarget ssid_history FK: some bssids are missing from app.networks';
    END IF;
END $$;

ALTER TABLE ONLY app.observations
    DROP CONSTRAINT IF EXISTS fk_obs_bssid;
ALTER TABLE ONLY app.observations
    ADD CONSTRAINT fk_obs_bssid
    FOREIGN KEY (bssid)
    REFERENCES app.networks(bssid)
    DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE ONLY app.note_media
    DROP CONSTRAINT IF EXISTS note_media_bssid_fkey;
ALTER TABLE ONLY app.note_media
    ADD CONSTRAINT note_media_bssid_fkey
    FOREIGN KEY (bssid)
    REFERENCES app.networks(bssid)
    ON DELETE CASCADE;

DO $$
BEGIN
    IF to_regclass('app.ssid_history') IS NOT NULL THEN
        ALTER TABLE ONLY app.ssid_history
            DROP CONSTRAINT IF EXISTS ssid_history_bssid_fkey;
        ALTER TABLE ONLY app.ssid_history
            ADD CONSTRAINT ssid_history_bssid_fkey
            FOREIGN KEY (bssid)
            REFERENCES app.networks(bssid)
            DEFERRABLE INITIALLY DEFERRED;
    END IF;
END $$;

COMMIT;
