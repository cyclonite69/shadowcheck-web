# Functions and Stored Procedures

## 1. Network Management Functions

### Upsert Network

```sql
CREATE OR REPLACE FUNCTION app.upsert_network(
    p_bssid MACADDR,
    p_ssid TEXT,
    p_channel INTEGER DEFAULT NULL,
    p_frequency_mhz INTEGER DEFAULT NULL,
    p_encryption TEXT[] DEFAULT NULL,
    p_latitude NUMERIC DEFAULT NULL,
    p_longitude NUMERIC DEFAULT NULL,
    p_signal_dbm INTEGER DEFAULT NULL,
    p_observed_at TIMESTAMPTZ DEFAULT NOW(),
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS MACADDR AS $$
DECLARE
    v_location GEOGRAPHY;
BEGIN
    -- Create geography point if coordinates provided
    IF p_latitude IS NOT NULL AND p_longitude IS NOT NULL THEN
        v_location := ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography;
    END IF;

    INSERT INTO app.networks (
        bssid, ssid, channel, frequency_mhz, encryption,
        latitude, longitude, location,
        max_signal_dbm, min_signal_dbm, avg_signal_dbm,
        first_seen_at, last_seen_at, observation_count, metadata
    ) VALUES (
        p_bssid, p_ssid, p_channel, p_frequency_mhz, p_encryption,
        p_latitude, p_longitude, v_location,
        p_signal_dbm, p_signal_dbm, p_signal_dbm,
        p_observed_at, p_observed_at, 1, p_metadata
    )
    ON CONFLICT (bssid) DO UPDATE SET
        ssid = COALESCE(EXCLUDED.ssid, networks.ssid),
        channel = COALESCE(EXCLUDED.channel, networks.channel),
        frequency_mhz = COALESCE(EXCLUDED.frequency_mhz, networks.frequency_mhz),
        encryption = COALESCE(EXCLUDED.encryption, networks.encryption),
        latitude = COALESCE(EXCLUDED.latitude, networks.latitude),
        longitude = COALESCE(EXCLUDED.longitude, networks.longitude),
        location = COALESCE(EXCLUDED.location, networks.location),
        max_signal_dbm = GREATEST(networks.max_signal_dbm, EXCLUDED.max_signal_dbm),
        min_signal_dbm = LEAST(networks.min_signal_dbm, EXCLUDED.min_signal_dbm),
        last_seen_at = GREATEST(networks.last_seen_at, EXCLUDED.last_seen_at),
        observation_count = networks.observation_count + 1,
        metadata = networks.metadata || EXCLUDED.metadata,
        updated_at = NOW();

    RETURN p_bssid;
END;
$$ LANGUAGE plpgsql;
```

### Calculate Threat Score

```sql
CREATE OR REPLACE FUNCTION app.calculate_threat_score(p_bssid MACADDR)
RETURNS NUMERIC AS $$
DECLARE
    v_score NUMERIC := 0.5;
    v_network RECORD;
    v_obs_count INTEGER;
    v_unique_locs INTEGER;
BEGIN
    -- Get network details
    SELECT * INTO v_network FROM app.networks WHERE bssid = p_bssid;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    -- Get observation stats
    SELECT COUNT(*), COUNT(DISTINCT ST_SnapToGrid(location::geometry, 0.001))
    INTO v_obs_count, v_unique_locs
    FROM app.observations
    WHERE bssid = p_bssid;

    -- Scoring logic
    -- Hidden SSID: +0.2
    IF v_network.ssid_hidden THEN
        v_score := v_score + 0.2;
    END IF;

    -- Open network: +0.1
    IF v_network.encryption IS NULL OR array_length(v_network.encryption, 1) = 0 THEN
        v_score := v_score + 0.1;
    END IF;

    -- Mobile (many locations): +0.3
    IF v_unique_locs > 10 THEN
        v_score := v_score + 0.3;
    END IF;

    -- Suspicious manufacturer
    IF v_network.manufacturer IN ('Pineapple', 'Hak5', 'Unknown') THEN
        v_score := v_score + 0.2;
    END IF;

    -- Clamp to 0-1
    v_score := LEAST(GREATEST(v_score, 0.0), 1.0);

    RETURN v_score;
END;
$$ LANGUAGE plpgsql;
```

## 2. Trilateration Functions

### Calculate AP Location

```sql
CREATE OR REPLACE FUNCTION app.calculate_ap_location(
    p_bssid MACADDR,
    p_min_observations INTEGER DEFAULT 3
)
RETURNS GEOGRAPHY AS $$
DECLARE
    v_location GEOGRAPHY;
    v_obs_count INTEGER;
BEGIN
    -- Count observations
    SELECT COUNT(*) INTO v_obs_count
    FROM app.observations
    WHERE bssid = p_bssid AND location IS NOT NULL;

    IF v_obs_count < p_min_observations THEN
        RETURN NULL;
    END IF;

    -- Weighted centroid based on signal strength
    SELECT ST_Centroid(
        ST_Collect(
            ST_SetSRID(
                ST_MakePoint(longitude, latitude),
                4326
            )
        )
    )::geography INTO v_location
    FROM app.observations
    WHERE bssid = p_bssid
        AND location IS NOT NULL
        AND signal_dbm > -90  -- Filter weak signals
    ORDER BY signal_dbm DESC
    LIMIT 100;  -- Use top 100 strongest signals

    RETURN v_location;
END;
$$ LANGUAGE plpgsql;
```

## 3. Import Functions

### Import WiGLE CSV

```sql
CREATE OR REPLACE FUNCTION app.import_wigle_csv(
    p_import_id BIGINT,
    p_csv_data JSONB[]
)
RETURNS TABLE(imported INTEGER, updated INTEGER, failed INTEGER) AS $$
DECLARE
    v_imported INTEGER := 0;
    v_updated INTEGER := 0;
    v_failed INTEGER := 0;
    v_row JSONB;
BEGIN
    FOREACH v_row IN ARRAY p_csv_data LOOP
        BEGIN
            PERFORM app.upsert_network(
                p_bssid := (v_row->>'MAC')::macaddr,
                p_ssid := v_row->>'SSID',
                p_channel := (v_row->>'Channel')::integer,
                p_encryption := string_to_array(v_row->>'AuthMode', '-'),
                p_latitude := (v_row->>'CurrentLatitude')::numeric,
                p_longitude := (v_row->>'CurrentLongitude')::numeric,
                p_signal_dbm := (v_row->>'RSSI')::integer,
                p_observed_at := (v_row->>'FirstSeen')::timestamptz,
                p_metadata := jsonb_build_object('source', 'wigle_app', 'import_id', p_import_id)
            );

            -- Insert observation
            INSERT INTO app.observations (
                bssid, latitude, longitude, location, signal_dbm,
                observed_at, source_type, import_id
            ) VALUES (
                (v_row->>'MAC')::macaddr,
                (v_row->>'CurrentLatitude')::numeric,
                (v_row->>'CurrentLongitude')::numeric,
                ST_SetSRID(ST_MakePoint(
                    (v_row->>'CurrentLongitude')::numeric,
                    (v_row->>'CurrentLatitude')::numeric
                ), 4326)::geography,
                (v_row->>'RSSI')::integer,
                (v_row->>'FirstSeen')::timestamptz,
                'wigle_app',
                p_import_id
            );

            v_imported := v_imported + 1;

        EXCEPTION WHEN OTHERS THEN
            v_failed := v_failed + 1;
        END;
    END LOOP;

    RETURN QUERY SELECT v_imported, v_updated, v_failed;
END;
$$ LANGUAGE plpgsql;
```

## 4. Geospatial Functions

### Find Networks Near Location

```sql
CREATE OR REPLACE FUNCTION app.find_networks_near(
    p_latitude NUMERIC,
    p_longitude NUMERIC,
    p_radius_meters NUMERIC DEFAULT 1000,
    p_limit INTEGER DEFAULT 100
)
RETURNS TABLE(
    bssid MACADDR,
    ssid TEXT,
    distance_meters NUMERIC,
    signal_dbm INTEGER,
    threat_score NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        n.bssid,
        n.ssid,
        ST_Distance(
            n.location,
            ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography
        ) as distance_meters,
        n.max_signal_dbm,
        nt.threat_score
    FROM app.networks n
    LEFT JOIN app.network_tags nt ON n.bssid = nt.bssid
    WHERE ST_DWithin(
        n.location,
        ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography,
        p_radius_meters
    )
    ORDER BY distance_meters
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;
```

### Get Network Movement Pattern

```sql
CREATE OR REPLACE FUNCTION app.get_network_movement(
    p_bssid MACADDR,
    p_days INTEGER DEFAULT 30
)
RETURNS TABLE(
    observation_date DATE,
    location GEOGRAPHY,
    observation_count BIGINT,
    avg_signal NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        DATE(observed_at) as observation_date,
        ST_Centroid(ST_Collect(o.location::geometry))::geography as location,
        COUNT(*) as observation_count,
        AVG(signal_dbm) as avg_signal
    FROM app.observations o
    WHERE bssid = p_bssid
        AND observed_at > NOW() - (p_days || ' days')::interval
    GROUP BY DATE(observed_at)
    ORDER BY observation_date;
END;
$$ LANGUAGE plpgsql;
```

## 5. Utility Functions

### Update Network Statistics

```sql
CREATE OR REPLACE FUNCTION app.update_network_stats(p_bssid MACADDR)
RETURNS void AS $$
BEGIN
    UPDATE app.networks SET
        observation_count = (
            SELECT COUNT(*) FROM app.observations WHERE bssid = p_bssid
        ),
        observation_days = (
            SELECT COUNT(DISTINCT DATE(observed_at))
            FROM app.observations WHERE bssid = p_bssid
        ),
        avg_signal_dbm = (
            SELECT AVG(signal_dbm) FROM app.observations WHERE bssid = p_bssid
        ),
        updated_at = NOW()
    WHERE bssid = p_bssid;
END;
$$ LANGUAGE plpgsql;
```
