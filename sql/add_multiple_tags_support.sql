-- Add support for multiple tags per network
-- This allows a network to have both THREAT and INVESTIGATE tags simultaneously

-- Add new tags column (JSONB array)
ALTER TABLE app.network_tags 
ADD COLUMN tags JSONB DEFAULT '[]'::jsonb;

-- Create index for efficient tag queries
CREATE INDEX idx_network_tags_tags_gin ON app.network_tags USING gin(tags);

-- Migrate existing single threat_tag to tags array
UPDATE app.network_tags 
SET tags = CASE 
  WHEN threat_tag IS NOT NULL THEN jsonb_build_array(threat_tag)
  ELSE '[]'::jsonb
END
WHERE tags = '[]'::jsonb;

-- Add helper functions for tag management
CREATE OR REPLACE FUNCTION app.network_has_tag(network_tags JSONB, tag_name TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN network_tags ? tag_name;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION app.network_add_tag(network_tags JSONB, tag_name TEXT)
RETURNS JSONB AS $$
BEGIN
  IF NOT (network_tags ? tag_name) THEN
    RETURN network_tags || jsonb_build_array(tag_name);
  END IF;
  RETURN network_tags;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION app.network_remove_tag(network_tags JSONB, tag_name TEXT)
RETURNS JSONB AS $$
BEGIN
  RETURN (
    SELECT jsonb_agg(tag)
    FROM jsonb_array_elements_text(network_tags) AS tag
    WHERE tag != tag_name
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create view for easy querying
CREATE OR REPLACE VIEW app.network_tags_expanded AS
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
  app.network_has_tag(nt.tags, 'SUSPECT') as is_suspect
FROM app.network_tags nt;
