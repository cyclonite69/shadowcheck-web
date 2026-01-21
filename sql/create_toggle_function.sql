-- Create toggle function for easier tag management
CREATE OR REPLACE FUNCTION app.network_toggle_tag(target_bssid TEXT, tag_name TEXT, tag_notes TEXT DEFAULT NULL)
RETURNS TABLE(action TEXT, bssid TEXT, tags JSONB) AS $$
DECLARE
    current_tags JSONB;
    has_tag BOOLEAN;
    result_action TEXT;
BEGIN
    -- Get current tags or create empty array
    SELECT nt.tags INTO current_tags 
    FROM app.network_tags nt 
    WHERE nt.bssid = target_bssid;
    
    IF current_tags IS NULL THEN
        -- Network doesn't exist, create with tag
        INSERT INTO app.network_tags (bssid, tags, notes, created_by)
        VALUES (target_bssid, jsonb_build_array(tag_name), tag_notes, 'admin');
        
        result_action := 'added';
        current_tags := jsonb_build_array(tag_name);
    ELSE
        -- Check if tag exists
        has_tag := current_tags ? tag_name;
        
        IF has_tag THEN
            -- Remove tag
            UPDATE app.network_tags 
            SET tags = app.network_remove_tag(app.network_tags.tags, tag_name),
                updated_at = NOW()
            WHERE app.network_tags.bssid = target_bssid;
            
            result_action := 'removed';
            current_tags := app.network_remove_tag(current_tags, tag_name);
        ELSE
            -- Add tag
            UPDATE app.network_tags 
            SET tags = app.network_add_tag(app.network_tags.tags, tag_name),
                notes = COALESCE(tag_notes, app.network_tags.notes),
                updated_at = NOW()
            WHERE app.network_tags.bssid = target_bssid;
            
            result_action := 'added';
            current_tags := app.network_add_tag(current_tags, tag_name);
        END IF;
    END IF;
    
    RETURN QUERY SELECT result_action, target_bssid, current_tags;
END;
$$ LANGUAGE plpgsql;
