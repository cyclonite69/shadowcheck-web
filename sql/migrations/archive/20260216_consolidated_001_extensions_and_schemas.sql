-- ============================================================================
-- Consolidated Migration 001: Extensions and Schemas
-- ============================================================================
-- Creates required PostgreSQL extensions and application schemas.
-- Source: pg_dump --schema-only of live database (2026-02-16)
-- ============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS postgis CASCADE;
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Application schemas
CREATE SCHEMA IF NOT EXISTS app;
CREATE SCHEMA IF NOT EXISTS import;
