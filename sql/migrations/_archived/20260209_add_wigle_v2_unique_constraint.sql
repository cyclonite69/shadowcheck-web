-- Add missing unique constraint to wigle_v2_networks_search
-- This constraint is required for ON CONFLICT clause to work properly

ALTER TABLE app.wigle_v2_networks_search 
ADD CONSTRAINT wigle_v2_networks_search_unique 
UNIQUE (bssid, trilat, trilong, lastupdt);
