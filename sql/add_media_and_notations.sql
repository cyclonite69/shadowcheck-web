-- Add media storage support to network tags
-- Supports images, videos, and enhanced notations

-- Add media storage table
CREATE TABLE IF NOT EXISTS app.network_media (
    id BIGSERIAL PRIMARY KEY,
    bssid VARCHAR(17) NOT NULL,
    media_type VARCHAR(10) NOT NULL CHECK (media_type IN ('image', 'video')),
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255),
    file_size BIGINT,
    mime_type VARCHAR(100),
    media_data BYTEA NOT NULL,  -- Store binary data directly in DB
    thumbnail BYTEA,            -- Small thumbnail for quick preview
    description TEXT,
    uploaded_by VARCHAR(100) DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for media table
CREATE INDEX idx_network_media_bssid ON app.network_media(bssid);
CREATE INDEX idx_network_media_type ON app.network_media(media_type);
CREATE INDEX idx_network_media_created ON app.network_media(created_at DESC);

-- Add enhanced notation support to network_tags
ALTER TABLE app.network_tags 
ADD COLUMN IF NOT EXISTS detailed_notes JSONB DEFAULT '[]'::jsonb;

-- Update trigger for media table
CREATE OR REPLACE FUNCTION app.network_media_update_trigger()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER network_media_update
    BEFORE UPDATE ON app.network_media
    FOR EACH ROW
    EXECUTE FUNCTION app.network_media_update_trigger();

-- Function to add notation with timestamp
CREATE OR REPLACE FUNCTION app.network_add_notation(target_bssid TEXT, note_text TEXT, note_type TEXT DEFAULT 'general')
RETURNS JSONB AS $$
DECLARE
    new_note JSONB;
    current_notes JSONB;
BEGIN
    -- Create new note object
    new_note := jsonb_build_object(
        'id', extract(epoch from now())::bigint,
        'text', note_text,
        'type', note_type,
        'timestamp', now(),
        'author', 'user'
    );
    
    -- Get current notes or empty array
    SELECT detailed_notes INTO current_notes 
    FROM app.network_tags 
    WHERE bssid = target_bssid;
    
    IF current_notes IS NULL THEN
        current_notes := '[]'::jsonb;
    END IF;
    
    -- Add new note to array
    current_notes := current_notes || new_note;
    
    -- Update or insert network record
    INSERT INTO app.network_tags (bssid, detailed_notes, created_by)
    VALUES (target_bssid, current_notes, 'user')
    ON CONFLICT (bssid) DO UPDATE SET
        detailed_notes = current_notes,
        updated_at = NOW();
    
    RETURN new_note;
END;
$$ LANGUAGE plpgsql;

-- Function to get media count for a network
CREATE OR REPLACE FUNCTION app.network_media_count(target_bssid TEXT)
RETURNS TABLE(images BIGINT, videos BIGINT, total BIGINT) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) FILTER (WHERE media_type = 'image') as images,
        COUNT(*) FILTER (WHERE media_type = 'video') as videos,
        COUNT(*) as total
    FROM app.network_media 
    WHERE bssid = target_bssid;
END;
$$ LANGUAGE plpgsql;

-- Enhanced view with media and notation counts
CREATE OR REPLACE VIEW app.network_tags_full AS
SELECT 
    nt.*,
    CASE 
        WHEN jsonb_array_length(nt.tags) > 0 
        THEN array(SELECT jsonb_array_elements_text(nt.tags))
        ELSE ARRAY[]::text[]
    END as tag_array,
    app.network_has_tag(nt.tags, 'THREAT') as is_threat,
    app.network_has_tag(nt.tags, 'INVESTIGATE') as is_investigate,
    app.network_has_tag(nt.tags, 'FALSE_POSITIVE') as is_false_positive,
    app.network_has_tag(nt.tags, 'SUSPECT') as is_suspect,
    COALESCE(jsonb_array_length(nt.detailed_notes), 0) as notation_count,
    (SELECT COUNT(*) FROM app.network_media nm WHERE nm.bssid = nt.bssid AND nm.media_type = 'image') as image_count,
    (SELECT COUNT(*) FROM app.network_media nm WHERE nm.bssid = nt.bssid AND nm.media_type = 'video') as video_count,
    (SELECT COUNT(*) FROM app.network_media nm WHERE nm.bssid = nt.bssid) as total_media_count
FROM app.network_tags nt;
