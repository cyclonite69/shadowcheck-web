-- Ensure required extensions exist for geospatial operations.
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- Enable UUID generation if needed for downstream IDs.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
