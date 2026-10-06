-- Migration: network_media_timestamp_provenance
-- Description: Add nullable timestamp_source column to app.network_media for capture instant provenance
-- Rollback: ALTER TABLE app.network_media DROP COLUMN IF EXISTS timestamp_source;

ALTER TABLE app.network_media ADD COLUMN IF NOT EXISTS timestamp_source varchar(50);
