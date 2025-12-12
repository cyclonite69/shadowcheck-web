# Media, Sensors, and Device Metadata Tables

## 1. Scanning Device Metadata

**Purpose:** Track metadata about devices performing scans (phones, laptops, hardware)

```sql
CREATE TABLE app.scanning_devices (
    id SERIAL PRIMARY KEY,

    -- Device Identity
    device_uuid UUID DEFAULT gen_random_uuid() UNIQUE,
    device_name TEXT,
    device_type TEXT, -- 'android', 'ios', 'laptop', 'raspberry_pi', 'dedicated_hardware'

    -- Hardware Info
    manufacturer TEXT,
    model TEXT,
    os_type TEXT,
    os_version TEXT,
    app_version TEXT,

    -- Capabilities
    has_gps BOOLEAN DEFAULT FALSE,
    has_wifi BOOLEAN DEFAULT FALSE,
    has_bluetooth BOOLEAN DEFAULT FALSE,
    has_cellular BOOLEAN DEFAULT FALSE,
    has_camera BOOLEAN DEFAULT FALSE,
    capabilities JSONB, -- Full capability list

    -- Network Interfaces
    wifi_chipset TEXT,
    wifi_driver TEXT,
    bluetooth_version TEXT,
    cellular_modem TEXT,

    -- Calibration
    gps_accuracy_meters NUMERIC(8, 2),
    wifi_signal_offset_db INTEGER, -- Calibration offset
    bluetooth_signal_offset_db INTEGER,

    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    last_seen_at TIMESTAMPTZ,

    -- Metadata
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_scanning_devices_uuid ON app.scanning_devices(device_uuid);
CREATE INDEX idx_scanning_devices_type ON app.scanning_devices(device_type);
CREATE INDEX idx_scanning_devices_active ON app.scanning_devices(is_active);
```

## 2. Sensor Readings

**Purpose:** Store sensor data from mobile devices (accelerometer, gyroscope, magnetometer, etc.)

```sql
CREATE TABLE app.sensor_readings (
    id BIGSERIAL PRIMARY KEY,

    -- Device
    device_uuid UUID NOT NULL REFERENCES app.scanning_devices(device_uuid),

    -- Sensor Type
    sensor_type TEXT NOT NULL, -- 'accelerometer', 'gyroscope', 'magnetometer', 'barometer', 'light', 'proximity'
    sensor_name TEXT,

    -- Values (up to 3 axes)
    value_x REAL,
    value_y REAL,
    value_z REAL,
    value_scalar REAL, -- For single-value sensors

    -- Accuracy
    accuracy INTEGER, -- Sensor accuracy level

    -- Location context
    latitude NUMERIC(10, 7),
    longitude NUMERIC(10, 7),
    altitude_meters NUMERIC(8, 2),
    location GEOGRAPHY(POINT, 4326),

    -- Temporal
    timestamp TIMESTAMPTZ NOT NULL,

    -- Metadata
    metadata JSONB
) PARTITION BY RANGE (timestamp);

-- Create partitions (monthly)
CREATE TABLE app.sensor_readings_2025_01 PARTITION OF app.sensor_readings
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

-- Indexes
CREATE INDEX idx_sensor_readings_device ON app.sensor_readings(device_uuid);
CREATE INDEX idx_sensor_readings_type ON app.sensor_readings(sensor_type);
CREATE INDEX idx_sensor_readings_time ON app.sensor_readings USING brin(timestamp);
CREATE INDEX idx_sensor_readings_location ON app.sensor_readings USING gist(location);
```

## 3. Media Attachments

**Purpose:** Store photos, videos, audio recordings with full metadata in database

```sql
CREATE TABLE app.media_attachments (
    id BIGSERIAL PRIMARY KEY,

    -- Identity
    media_uuid UUID DEFAULT gen_random_uuid() UNIQUE,

    -- Association
    entity_type TEXT NOT NULL, -- 'network', 'device', 'observation', 'scan', 'note'
    entity_id TEXT NOT NULL, -- BSSID, MAC, or ID

    -- Media Type
    media_type TEXT NOT NULL, -- 'photo', 'video', 'audio', 'document', 'screenshot'
    mime_type TEXT NOT NULL,
    file_extension TEXT,

    -- Binary Data (stored in database)
    file_data BYTEA NOT NULL,
    file_size_bytes BIGINT NOT NULL,

    -- Image/Video Metadata
    width_pixels INTEGER,
    height_pixels INTEGER,
    duration_seconds NUMERIC(10, 2),
    frame_rate NUMERIC(6, 2),
    bitrate_kbps INTEGER,
    codec TEXT,

    -- Camera/Recording Metadata
    camera_make TEXT,
    camera_model TEXT,
    lens_model TEXT,
    focal_length_mm NUMERIC(6, 2),
    aperture NUMERIC(4, 2),
    iso INTEGER,
    shutter_speed TEXT,
    flash_used BOOLEAN,

    -- Location (EXIF or device GPS)
    latitude NUMERIC(10, 7),
    longitude NUMERIC(10, 7),
    altitude_meters NUMERIC(8, 2),
    location GEOGRAPHY(POINT, 4326),
    gps_accuracy_meters NUMERIC(8, 2),

    -- Orientation
    orientation INTEGER, -- EXIF orientation
    compass_heading NUMERIC(5, 2),

    -- Temporal
    captured_at TIMESTAMPTZ NOT NULL,
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),

    -- Device Info
    device_uuid UUID REFERENCES app.scanning_devices(device_uuid),

    -- Description
    title TEXT,
    description TEXT,
    tags TEXT[],

    -- Full EXIF/Metadata
    exif_data JSONB,
    metadata JSONB,

    -- Thumbnail (small preview)
    thumbnail_data BYTEA,
    thumbnail_width INTEGER,
    thumbnail_height INTEGER,

    -- Hash for deduplication
    file_hash TEXT UNIQUE, -- SHA256

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_media_entity ON app.media_attachments(entity_type, entity_id);
CREATE INDEX idx_media_type ON app.media_attachments(media_type);
CREATE INDEX idx_media_uuid ON app.media_attachments(media_uuid);
CREATE INDEX idx_media_device ON app.media_attachments(device_uuid);
CREATE INDEX idx_media_captured ON app.media_attachments USING brin(captured_at);
CREATE INDEX idx_media_location ON app.media_attachments USING gist(location);
CREATE INDEX idx_media_tags ON app.media_attachments USING gin(tags);
CREATE INDEX idx_media_hash ON app.media_attachments(file_hash);
CREATE INDEX idx_media_metadata ON app.media_attachments USING gin(metadata);
```

## 4. Device Sessions

**Purpose:** Track scanning sessions from mobile devices

```sql
CREATE TABLE app.device_sessions (
    id BIGSERIAL PRIMARY KEY,

    -- Device
    device_uuid UUID NOT NULL REFERENCES app.scanning_devices(device_uuid),

    -- Session
    session_uuid UUID DEFAULT gen_random_uuid() UNIQUE,
    session_name TEXT,

    -- Type
    session_type TEXT, -- 'wardriving', 'stationary', 'survey', 'investigation'

    -- Status
    status TEXT CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),

    -- Statistics
    networks_found INTEGER DEFAULT 0,
    observations_recorded INTEGER DEFAULT 0,
    distance_traveled_meters NUMERIC(12, 2),
    media_captured INTEGER DEFAULT 0,

    -- Location bounds
    start_location GEOGRAPHY(POINT, 4326),
    end_location GEOGRAPHY(POINT, 4326),
    bounding_box GEOGRAPHY(POLYGON, 4326),

    -- Temporal
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER,

    -- Battery/Performance
    battery_start_percent INTEGER,
    battery_end_percent INTEGER,
    battery_consumed_percent INTEGER,

    -- Metadata
    notes TEXT,
    metadata JSONB,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_device_sessions_device ON app.device_sessions(device_uuid);
CREATE INDEX idx_device_sessions_uuid ON app.device_sessions(session_uuid);
CREATE INDEX idx_device_sessions_status ON app.device_sessions(status);
CREATE INDEX idx_device_sessions_started ON app.device_sessions USING brin(started_at);
```

## 5. Update Observations Table

Add device and session tracking:

```sql
ALTER TABLE app.observations
    ADD COLUMN device_uuid UUID REFERENCES app.scanning_devices(device_uuid),
    ADD COLUMN session_uuid UUID REFERENCES app.device_sessions(session_uuid);

CREATE INDEX idx_observations_device ON app.observations(device_uuid);
CREATE INDEX idx_observations_session ON app.observations(session_uuid);
```

## Functions

### Store Media with Automatic Thumbnail

```sql
CREATE OR REPLACE FUNCTION app.store_media(
    p_entity_type TEXT,
    p_entity_id TEXT,
    p_media_type TEXT,
    p_mime_type TEXT,
    p_file_data BYTEA,
    p_latitude NUMERIC DEFAULT NULL,
    p_longitude NUMERIC DEFAULT NULL,
    p_captured_at TIMESTAMPTZ DEFAULT NOW(),
    p_device_uuid UUID DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
    v_media_uuid UUID;
    v_file_hash TEXT;
    v_location GEOGRAPHY;
BEGIN
    -- Calculate hash
    v_file_hash := encode(digest(p_file_data, 'sha256'), 'hex');

    -- Check for duplicate
    SELECT media_uuid INTO v_media_uuid
    FROM app.media_attachments
    WHERE file_hash = v_file_hash;

    IF v_media_uuid IS NOT NULL THEN
        -- Already exists, return existing UUID
        RETURN v_media_uuid;
    END IF;

    -- Create location
    IF p_latitude IS NOT NULL AND p_longitude IS NOT NULL THEN
        v_location := ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography;
    END IF;

    -- Insert media
    INSERT INTO app.media_attachments (
        entity_type, entity_id, media_type, mime_type,
        file_data, file_size_bytes, file_hash,
        latitude, longitude, location,
        captured_at, device_uuid, metadata
    ) VALUES (
        p_entity_type, p_entity_id, p_media_type, p_mime_type,
        p_file_data, length(p_file_data), v_file_hash,
        p_latitude, p_longitude, v_location,
        p_captured_at, p_device_uuid, p_metadata
    )
    RETURNING media_uuid INTO v_media_uuid;

    RETURN v_media_uuid;
END;
$$ LANGUAGE plpgsql;
```

### Get Media by Entity

```sql
CREATE OR REPLACE FUNCTION app.get_media_for_entity(
    p_entity_type TEXT,
    p_entity_id TEXT
)
RETURNS TABLE(
    media_uuid UUID,
    media_type TEXT,
    mime_type TEXT,
    file_size_bytes BIGINT,
    thumbnail_data BYTEA,
    captured_at TIMESTAMPTZ,
    latitude NUMERIC,
    longitude NUMERIC,
    title TEXT,
    description TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        m.media_uuid,
        m.media_type,
        m.mime_type,
        m.file_size_bytes,
        m.thumbnail_data,
        m.captured_at,
        m.latitude,
        m.longitude,
        m.title,
        m.description
    FROM app.media_attachments m
    WHERE m.entity_type = p_entity_type
        AND m.entity_id = p_entity_id
    ORDER BY m.captured_at DESC;
END;
$$ LANGUAGE plpgsql;
```

## Triggers

### Auto-populate Device Session Stats

```sql
CREATE OR REPLACE FUNCTION app.update_session_stats()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE app.device_sessions SET
        observations_recorded = (
            SELECT COUNT(*) FROM app.observations
            WHERE session_uuid = NEW.session_uuid
        ),
        networks_found = (
            SELECT COUNT(DISTINCT bssid) FROM app.observations
            WHERE session_uuid = NEW.session_uuid
        )
    WHERE session_uuid = NEW.session_uuid;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_observations_update_session
    AFTER INSERT ON app.observations
    FOR EACH ROW
    WHEN (NEW.session_uuid IS NOT NULL)
    EXECUTE FUNCTION app.update_session_stats();
```

## API Endpoints

### Upload Media

```javascript
// POST /api/media/upload
app.post('/api/media/upload', upload.single('file'), async (req, res) => {
  const { entity_type, entity_id, media_type, latitude, longitude, device_uuid } = req.body;
  const file = req.file;

  const result = await pool.query(
    'SELECT app.store_media($1, $2, $3, $4, $5, $6, $7, NOW(), $8, $9)',
    [
      entity_type,
      entity_id,
      media_type,
      file.mimetype,
      file.buffer,
      latitude,
      longitude,
      device_uuid,
      JSON.stringify(req.body.metadata || {}),
    ]
  );

  res.json({ media_uuid: result.rows[0].store_media });
});
```

### Get Media

```javascript
// GET /api/media/:uuid
app.get('/api/media/:uuid', async (req, res) => {
  const result = await pool.query(
    'SELECT file_data, mime_type, file_extension FROM app.media_attachments WHERE media_uuid = $1',
    [req.params.uuid]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Media not found' });
  }

  const media = result.rows[0];
  res.contentType(media.mime_type);
  res.send(media.file_data);
});
```

## Storage Considerations

### Large Object Storage (Alternative)

For very large files (>1GB), consider PostgreSQL Large Objects:

```sql
-- Alternative: Use OID for large files
CREATE TABLE app.media_attachments_lo (
    -- ... same columns ...
    file_oid OID, -- Reference to large object
    -- ... rest of columns ...
);
```

### Compression

Enable compression for BYTEA columns:

```sql
ALTER TABLE app.media_attachments
    ALTER COLUMN file_data SET STORAGE EXTERNAL;

-- Or use pg_compress for explicit compression
```

## Size Limits

```sql
-- Add constraint for reasonable file sizes
ALTER TABLE app.media_attachments
    ADD CONSTRAINT media_size_limit CHECK (file_size_bytes <= 104857600); -- 100MB max
```
