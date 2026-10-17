-- Migration: Add COMMERCIAL_CAMERA to the surveillance device-type allowlist constraint.
-- 20261017_170_add_commercial_camera_device_type.sql

DO $migration$
BEGIN
  -- Drop existing constraint
  ALTER TABLE ONLY app.surveillance_detections
    DROP CONSTRAINT IF EXISTS chk_surveillance_device_type;

  -- Add updated constraint with COMMERCIAL_CAMERA
  ALTER TABLE ONLY app.surveillance_detections
    ADD CONSTRAINT chk_surveillance_device_type
    CHECK ((device_type = ANY (ARRAY[
      'FLOCK_SAFETY_CAMERA'::text,
      'RAVEN_GUNSHOT_DETECTOR'::text,
      'SHOTSPOTTER_SENSOR'::text,
      'FS_EXT_BATTERY'::text,
      'AXON_BODY_CAMERA'::text,
      'MOTOROLA_BWC'::text,
      'AXON_SIGNAL_PERIPHERAL'::text,
      'BT_IMAGING_DEVICE'::text,
      'DEI_BWC'::text,
      'DASHCAM'::text,
      'RESIDENTIAL_CAMERA'::text,
      'COMMERCIAL_CAMERA'::text
    ])));
END
$migration$;

-- ROLLBACK:
-- ALTER TABLE ONLY app.surveillance_detections
--   DROP CONSTRAINT IF EXISTS chk_surveillance_device_type;
-- ALTER TABLE ONLY app.surveillance_detections
--   ADD CONSTRAINT chk_surveillance_device_type
--   CHECK ((device_type = ANY (ARRAY[
--     'FLOCK_SAFETY_CAMERA'::text, 'RAVEN_GUNSHOT_DETECTOR'::text, 'SHOTSPOTTER_SENSOR'::text,
--     'FS_EXT_BATTERY'::text, 'AXON_BODY_CAMERA'::text, 'MOTOROLA_BWC'::text,
--     'AXON_SIGNAL_PERIPHERAL'::text, 'BT_IMAGING_DEVICE'::text, 'DEI_BWC'::text,
--     'DASHCAM'::text, 'RESIDENTIAL_CAMERA'::text
--   ])));
