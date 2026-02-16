-- Function to enrich location with trilateration on insert
CREATE OR REPLACE FUNCTION app.enrich_location_trilateration()
RETURNS TRIGGER AS $$
BEGIN
  -- Look up AP location data
  SELECT 
    centroid_lat, centroid_lon, confidence_score, is_mobile
  INTO 
    NEW.trilat_lat, NEW.trilat_lon, NEW.trilat_confidence, NEW.is_mobile_network
  FROM app.ap_locations
  WHERE bssid = NEW.bssid
    AND is_mobile = FALSE
    AND confidence_score > 0.5;
  
  -- Set method if trilateration was applied
  IF NEW.trilat_lat IS NOT NULL THEN
    NEW.trilat_method := 'centroid';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on locations_legacy
DROP TRIGGER IF EXISTS trigger_enrich_trilateration ON app.locations_legacy;
CREATE TRIGGER trigger_enrich_trilateration
  BEFORE INSERT ON app.locations_legacy
  FOR EACH ROW
  EXECUTE FUNCTION app.enrich_location_trilateration();

-- Function to update AP locations incrementally
CREATE OR REPLACE FUNCTION app.update_ap_location()
RETURNS TRIGGER AS $$
BEGIN
  -- Update or insert AP location stats
  INSERT INTO app.ap_locations (
    bssid, ssid, observation_count, first_seen, last_seen,
    centroid_lat, centroid_lon, max_distance_m, is_mobile, confidence_score
  )
  SELECT 
    NEW.bssid,
    NEW.ssid,
    COUNT(*),
    MIN(TO_TIMESTAMP(time/1000)),
    MAX(TO_TIMESTAMP(time/1000)),
    AVG(lat),
    AVG(lon),
    ST_Distance(
      ST_MakePoint(MIN(lon), MIN(lat))::geography,
      ST_MakePoint(MAX(lon), MAX(lat))::geography
    ),
    CASE WHEN ST_Distance(
      ST_MakePoint(MIN(lon), MIN(lat))::geography,
      ST_MakePoint(MAX(lon), MAX(lat))::geography
    ) > 100 THEN TRUE ELSE FALSE END,
    CASE 
      WHEN COUNT(*) < 3 THEN 0.1
      WHEN ST_Distance(
        ST_MakePoint(MIN(lon), MIN(lat))::geography,
        ST_MakePoint(MAX(lon), MAX(lat))::geography
      ) > 1000 THEN 0.2
      WHEN ST_Distance(
        ST_MakePoint(MIN(lon), MIN(lat))::geography,
        ST_MakePoint(MAX(lon), MAX(lat))::geography
      ) > 100 THEN 0.5
      ELSE 0.9
    END
  FROM app.locations_legacy
  WHERE bssid = NEW.bssid
  GROUP BY bssid
  ON CONFLICT (bssid) DO UPDATE SET
    observation_count = EXCLUDED.observation_count,
    last_seen = EXCLUDED.last_seen,
    centroid_lat = EXCLUDED.centroid_lat,
    centroid_lon = EXCLUDED.centroid_lon,
    max_distance_m = EXCLUDED.max_distance_m,
    is_mobile = EXCLUDED.is_mobile,
    confidence_score = EXCLUDED.confidence_score,
    updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update AP locations after insert
DROP TRIGGER IF EXISTS trigger_update_ap_location ON app.locations_legacy;
CREATE TRIGGER trigger_update_ap_location
  AFTER INSERT ON app.locations_legacy
  FOR EACH ROW
  EXECUTE FUNCTION app.update_ap_location();

SELECT 'Trilateration triggers created successfully' as status;
