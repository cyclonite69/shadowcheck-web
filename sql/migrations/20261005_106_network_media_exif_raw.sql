-- Migration: network_media_exif_raw
-- Description: Add exif_raw jsonb column to app.network_media for complete forensic metadata retention
-- Rollback: sql/migrations/rollback/20261005_106_network_media_exif_raw.down.sql

ALTER TABLE app.network_media ADD COLUMN IF NOT EXISTS exif_raw jsonb;
