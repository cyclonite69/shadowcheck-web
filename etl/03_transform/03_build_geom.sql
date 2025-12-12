\echo 'Validate geometry and drop obvious outliers'

-- Remove rows with invalid coordinates before promotion.
DELETE FROM staging_locations_all_enriched
WHERE NOT (lat BETWEEN -90 AND 90 AND lon BETWEEN -180 AND 180);

-- Recompute geom defensively after the filter.
UPDATE staging_locations_all_enriched
SET geom = ST_SetSRID(ST_MakePoint(lon, lat), 4326);
