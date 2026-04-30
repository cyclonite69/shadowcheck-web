-- Migration: Drop legacy tag-scoring functions (v1)
-- Date: 2026-04-29
-- Purpose: Remove unused legacy scoring path and dependent upsert function.

DROP FUNCTION IF EXISTS app.upsert_network_tag(character varying, character varying, numeric, text, character varying);
DROP FUNCTION IF EXISTS app.calculate_threat_score(character varying, character varying, numeric);
