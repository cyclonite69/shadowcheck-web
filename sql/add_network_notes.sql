-- Network Notes and Context Menu Support
-- Phase 4: Right-click functionality

-- Network notes table
CREATE TABLE IF NOT EXISTS app.network_notes (
  id SERIAL PRIMARY KEY,
  bssid VARCHAR(17) NOT NULL,
  user_id VARCHAR(50) DEFAULT 'default_user',
  content TEXT NOT NULL,
  note_type VARCHAR(20) DEFAULT 'general',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_network_notes_bssid ON app.network_notes(bssid);
CREATE INDEX IF NOT EXISTS idx_network_notes_user ON app.network_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_network_notes_created ON app.network_notes(created_at DESC);

-- Note media attachments (reuse existing media table structure)
-- The network_media table already exists, we can link notes to media via bssid

-- Helper function to get note count per network
CREATE OR REPLACE FUNCTION app.network_note_count(network_bssid VARCHAR(17))
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER 
    FROM app.network_notes 
    WHERE bssid = network_bssid
  );
END;
$$ LANGUAGE plpgsql;

-- Helper function to add note
CREATE OR REPLACE FUNCTION app.network_add_note(
  network_bssid VARCHAR(17),
  note_content TEXT,
  note_type VARCHAR(20) DEFAULT 'general',
  user_name VARCHAR(50) DEFAULT 'default_user'
)
RETURNS INTEGER AS $$
DECLARE
  note_id INTEGER;
BEGIN
  INSERT INTO app.network_notes (bssid, user_id, content, note_type)
  VALUES (network_bssid, user_name, note_content, note_type)
  RETURNING id INTO note_id;
  
  RETURN note_id;
END;
$$ LANGUAGE plpgsql;

-- Update network explorer view to include note count
DROP VIEW IF EXISTS public.network_summary_with_notes;
CREATE VIEW public.network_summary_with_notes AS
SELECT 
  mv.*,
  app.network_note_count(mv.bssid) as note_count,
  app.network_media_count(mv.bssid) as media_count
FROM public.api_network_explorer_mv mv;

COMMENT ON TABLE app.network_notes IS 'User notes and observations for networks - supports right-click context menu';
COMMENT ON FUNCTION app.network_add_note IS 'Add note to network via right-click context menu';
