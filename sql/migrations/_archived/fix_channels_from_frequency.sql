-- Migration: Fix Channel/Frequency Mismatch
-- Purpose: Calculate correct WiFi channels from frequency, set NULL for Bluetooth/BLE
-- Date: 2025-11-23

BEGIN;

-- Create function to calculate channel from frequency
CREATE OR REPLACE FUNCTION calculate_channel_from_frequency(freq INTEGER)
RETURNS INTEGER AS $$
BEGIN
  -- WiFi 2.4 GHz band (channels 1-14)
  IF freq = 2412 THEN RETURN 1;
  ELSIF freq = 2417 THEN RETURN 2;
  ELSIF freq = 2422 THEN RETURN 3;
  ELSIF freq = 2427 THEN RETURN 4;
  ELSIF freq = 2432 THEN RETURN 5;
  ELSIF freq = 2437 THEN RETURN 6;
  ELSIF freq = 2442 THEN RETURN 7;
  ELSIF freq = 2447 THEN RETURN 8;
  ELSIF freq = 2452 THEN RETURN 9;
  ELSIF freq = 2457 THEN RETURN 10;
  ELSIF freq = 2462 THEN RETURN 11;
  ELSIF freq = 2467 THEN RETURN 12;
  ELSIF freq = 2472 THEN RETURN 13;
  ELSIF freq = 2484 THEN RETURN 14;
  
  -- WiFi 5 GHz band (channels 36-165)
  ELSIF freq BETWEEN 5170 AND 5825 AND (freq - 5000) % 5 = 0 THEN
    RETURN (freq - 5000) / 5;
  
  -- Bluetooth/BLE or invalid frequency
  ELSE
    RETURN NULL;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Update all channels based on frequency
UPDATE app.networks_legacy
SET channel = calculate_channel_from_frequency(frequency)
WHERE frequency IS NOT NULL;

-- Create trigger function to auto-calculate channel on insert/update
CREATE OR REPLACE FUNCTION auto_calculate_channel()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.frequency IS NOT NULL THEN
    NEW.channel := calculate_channel_from_frequency(NEW.frequency);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and create new one
DROP TRIGGER IF EXISTS trigger_auto_calculate_channel ON app.networks_legacy;
CREATE TRIGGER trigger_auto_calculate_channel
  BEFORE INSERT OR UPDATE OF frequency
  ON app.networks_legacy
  FOR EACH ROW
  EXECUTE FUNCTION auto_calculate_channel();

-- Verify results
SELECT 
  'Fixed negative channels' as action,
  COUNT(*) as count
FROM app.networks_legacy 
WHERE channel < 0;

SELECT 
  'WiFi 2.4GHz with channels' as action,
  COUNT(*) as count
FROM app.networks_legacy 
WHERE frequency BETWEEN 2412 AND 2484 AND channel IS NOT NULL;

SELECT 
  'WiFi 5GHz with channels' as action,
  COUNT(*) as count
FROM app.networks_legacy 
WHERE frequency BETWEEN 5170 AND 5825 AND channel IS NOT NULL;

SELECT 
  'Bluetooth/BLE with NULL channels' as action,
  COUNT(*) as count
FROM app.networks_legacy 
WHERE frequency IS NOT NULL 
  AND (frequency < 2400 OR frequency > 6000) 
  AND channel IS NULL;

COMMIT;

-- Summary
SELECT 'Migration completed successfully!' as status;
