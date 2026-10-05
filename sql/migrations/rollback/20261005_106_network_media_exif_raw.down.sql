-- Rollback Migration: Drop exif_raw jsonb column from app.network_media
-- Date: 2026-10-05
-- Target Table: app.network_media

ALTER TABLE app.network_media DROP COLUMN IF EXISTS exif_raw;
