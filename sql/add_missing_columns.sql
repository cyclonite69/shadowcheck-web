-- Add missing columns to materialized view
ALTER MATERIALIZED VIEW public.api_network_explorer_mv 
ADD COLUMN unique_days bigint,
ADD COLUMN unique_locations bigint;
