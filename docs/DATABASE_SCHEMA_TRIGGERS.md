# Triggers and Automation

## 1. Timestamp Triggers

### Auto-update updated_at

```sql
CREATE OR REPLACE FUNCTION app.update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER trg_networks_update_timestamp
    BEFORE UPDATE ON app.networks
    FOR EACH ROW
    EXECUTE FUNCTION app.update_timestamp();

CREATE TRIGGER trg_devices_update_timestamp
    BEFORE UPDATE ON app.devices
    FOR EACH ROW
    EXECUTE FUNCTION app.update_timestamp();

CREATE TRIGGER trg_network_tags_update_timestamp
    BEFORE UPDATE ON app.network_tags
    FOR EACH ROW
    EXECUTE FUNCTION app.update_timestamp();
```

## 2. Audit Trail Triggers

### Track Tag Changes

```sql
CREATE OR REPLACE FUNCTION app.audit_tag_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- Append to tag_history
    NEW.tag_history = COALESCE(NEW.tag_history, '[]'::jsonb) || jsonb_build_object(
        'timestamp', NOW(),
        'old_tag', OLD.tag_type,
        'new_tag', NEW.tag_type,
        'old_score', OLD.threat_score,
        'new_score', NEW.threat_score,
        'changed_by', NEW.tagged_by
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_network_tags_audit
    BEFORE UPDATE ON app.network_tags
    FOR EACH ROW
    WHEN (OLD.tag_type IS DISTINCT FROM NEW.tag_type OR
          OLD.threat_score IS DISTINCT FROM NEW.threat_score)
    EXECUTE FUNCTION app.audit_tag_changes();
```

## 3. Geospatial Triggers

### Auto-populate Geography Column

```sql
CREATE OR REPLACE FUNCTION app.populate_geography()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
        NEW.location = ST_SetSRID(
            ST_MakePoint(NEW.longitude, NEW.latitude),
            4326
        )::geography;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_networks_populate_geography
    BEFORE INSERT OR UPDATE OF latitude, longitude ON app.networks
    FOR EACH ROW
    EXECUTE FUNCTION app.populate_geography();

CREATE TRIGGER trg_observations_populate_geography
    BEFORE INSERT OR UPDATE OF latitude, longitude ON app.observations
    FOR EACH ROW
    EXECUTE FUNCTION app.populate_geography();
```

## 4. Trilateration Triggers

### Auto-calculate AP Location

```sql
CREATE OR REPLACE FUNCTION app.trigger_trilateration()
RETURNS TRIGGER AS $$
DECLARE
    v_obs_count INTEGER;
    v_new_location GEOGRAPHY;
BEGIN
    -- Check if we have enough observations
    SELECT COUNT(*) INTO v_obs_count
    FROM app.observations
    WHERE bssid = NEW.bssid;

    -- Recalculate every 10 observations
    IF v_obs_count % 10 = 0 THEN
        v_new_location := app.calculate_ap_location(NEW.bssid);

        IF v_new_location IS NOT NULL THEN
            UPDATE app.networks
            SET trilat_location = v_new_location,
                trilat_confidence = LEAST(v_obs_count::numeric / 100.0, 1.0)
            WHERE bssid = NEW.bssid;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_observations_trilateration
    AFTER INSERT ON app.observations
    FOR EACH ROW
    EXECUTE FUNCTION app.trigger_trilateration();
```

## 5. Statistics Triggers

### Update Network Stats on Observation

```sql
CREATE OR REPLACE FUNCTION app.update_network_on_observation()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE app.networks SET
        last_seen_at = GREATEST(last_seen_at, NEW.observed_at),
        observation_count = observation_count + 1,
        max_signal_dbm = GREATEST(COALESCE(max_signal_dbm, -999), NEW.signal_dbm),
        min_signal_dbm = LEAST(COALESCE(min_signal_dbm, 999), NEW.signal_dbm)
    WHERE bssid = NEW.bssid;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_observations_update_network
    AFTER INSERT ON app.observations
    FOR EACH ROW
    EXECUTE FUNCTION app.update_network_on_observation();
```

## 6. ML Triggers

### Auto-score New Networks

```sql
CREATE OR REPLACE FUNCTION app.auto_score_network()
RETURNS TRIGGER AS $$
DECLARE
    v_score NUMERIC;
BEGIN
    -- Calculate initial threat score
    v_score := app.calculate_threat_score(NEW.bssid);

    -- Insert initial tag if score is significant
    IF v_score > 0.6 THEN
        INSERT INTO app.network_tags (
            bssid, tag_type, threat_score, ml_confidence, tagged_by
        ) VALUES (
            NEW.bssid,
            CASE
                WHEN v_score >= 0.9 THEN 'THREAT'
                WHEN v_score >= 0.7 THEN 'INVESTIGATE'
                ELSE 'UNKNOWN'
            END,
            v_score,
            0.5,
            'system'
        )
        ON CONFLICT (bssid) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_networks_auto_score
    AFTER INSERT ON app.networks
    FOR EACH ROW
    EXECUTE FUNCTION app.auto_score_network();
```

## 7. Enrichment Triggers

### Trigger Enrichment on New Network

```sql
CREATE OR REPLACE FUNCTION app.queue_enrichment()
RETURNS TRIGGER AS $$
BEGIN
    -- Only queue if we have a location
    IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
        -- Insert into enrichment queue (could be a separate table)
        INSERT INTO app.enrichment_queue (bssid, latitude, longitude, queued_at)
        VALUES (NEW.bssid, NEW.latitude, NEW.longitude, NOW())
        ON CONFLICT (bssid) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Note: enrichment_queue table would need to be created
```

## 8. Partition Management

### Auto-create Observation Partitions

```sql
CREATE OR REPLACE FUNCTION app.create_observation_partition()
RETURNS TRIGGER AS $$
DECLARE
    v_partition_name TEXT;
    v_start_date DATE;
    v_end_date DATE;
BEGIN
    v_start_date := DATE_TRUNC('month', NEW.observed_at);
    v_end_date := v_start_date + INTERVAL '1 month';
    v_partition_name := 'observations_' || TO_CHAR(v_start_date, 'YYYY_MM');

    -- Check if partition exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_class WHERE relname = v_partition_name
    ) THEN
        EXECUTE format(
            'CREATE TABLE IF NOT EXISTS app.%I PARTITION OF app.observations
             FOR VALUES FROM (%L) TO (%L)',
            v_partition_name,
            v_start_date,
            v_end_date
        );

        RAISE NOTICE 'Created partition: %', v_partition_name;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_observations_create_partition
    BEFORE INSERT ON app.observations
    FOR EACH ROW
    EXECUTE FUNCTION app.create_observation_partition();
```

## 9. Data Quality Triggers

### Validate Coordinates

```sql
CREATE OR REPLACE FUNCTION app.validate_coordinates()
RETURNS TRIGGER AS $$
BEGIN
    -- Validate latitude
    IF NEW.latitude IS NOT NULL AND (NEW.latitude < -90 OR NEW.latitude > 90) THEN
        RAISE EXCEPTION 'Invalid latitude: %', NEW.latitude;
    END IF;

    -- Validate longitude
    IF NEW.longitude IS NOT NULL AND (NEW.longitude < -180 OR NEW.longitude > 180) THEN
        RAISE EXCEPTION 'Invalid longitude: %', NEW.longitude;
    END IF;

    -- Validate signal strength
    IF NEW.signal_dbm IS NOT NULL AND (NEW.signal_dbm < -120 OR NEW.signal_dbm > 0) THEN
        RAISE WARNING 'Unusual signal strength: %', NEW.signal_dbm;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_observations_validate
    BEFORE INSERT OR UPDATE ON app.observations
    FOR EACH ROW
    EXECUTE FUNCTION app.validate_coordinates();
```

## 10. Notification Triggers

### Notify on High Threat Detection

```sql
CREATE OR REPLACE FUNCTION app.notify_high_threat()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.threat_score >= 0.9 AND NEW.tag_type = 'THREAT' THEN
        PERFORM pg_notify(
            'high_threat_detected',
            json_build_object(
                'bssid', NEW.bssid::text,
                'threat_score', NEW.threat_score,
                'timestamp', NOW()
            )::text
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_network_tags_notify
    AFTER INSERT OR UPDATE ON app.network_tags
    FOR EACH ROW
    WHEN (NEW.threat_score >= 0.9)
    EXECUTE FUNCTION app.notify_high_threat();
```
