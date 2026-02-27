-- Quick diagnostic for quality filter issue
-- Run this to check if quality filtering is breaking your data

-- Check if quality filter columns exist
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'app' 
  AND table_name = 'observations'
  AND column_name LIKE '%quality%';

-- Check quality filter distribution
SELECT 
  is_quality_filtered,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as percentage
FROM app.observations
GROUP BY is_quality_filtered
ORDER BY is_quality_filtered NULLS FIRST;

-- Check if MV has data
SELECT COUNT(*) as mv_row_count FROM app.api_network_explorer_mv;

-- Check if observations table has data
SELECT COUNT(*) as obs_row_count FROM app.observations;

-- Check if networks table has data
SELECT COUNT(*) as network_count FROM app.networks;
