-- Update security parsing in existing materialized view
-- This improves detection of modern WiFi security types

-- First, let's see what we're working with
SELECT security, COUNT(*) as count, 
       array_agg(DISTINCT capabilities ORDER BY capabilities) FILTER (WHERE capabilities IS NOT NULL) as sample_capabilities
FROM api_network_explorer_mv 
WHERE type = 'W' 
GROUP BY security 
ORDER BY count DESC;
