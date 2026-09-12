-- Migration: Add the surveillance device-type allowlist constraint.
-- 20260912_059_add_surveillance_device_type_constraint.sql

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_surveillance_device_type'
  ) THEN
    ALTER TABLE ONLY app.surveillance_detections
      ADD CONSTRAINT chk_surveillance_device_type
      CHECK ((device_type = ANY (ARRAY['FLOCK_SAFETY_CAMERA'::text, 'RAVEN_GUNSHOT_DETECTOR'::text, 'SHOTSPOTTER_SENSOR'::text, 'FS_EXT_BATTERY'::text, 'AXON_BODY_CAMERA'::text, 'MOTOROLA_BWC'::text, 'AXON_SIGNAL_PERIPHERAL'::text, 'BT_IMAGING_DEVICE'::text, 'DEI_BWC'::text, 'DASHCAM'::text, 'RESIDENTIAL_CAMERA'::text])));
  END IF;
END
$migration$;

-- ROLLBACK:
-- ALTER TABLE ONLY app.surveillance_detections
--   DROP CONSTRAINT IF EXISTS chk_surveillance_device_type;
