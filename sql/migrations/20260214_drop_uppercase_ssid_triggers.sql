-- Drop uppercase SSID enforcement triggers
-- SSIDs should preserve original case from Kismet/WiGLE imports.
-- BSSIDs are already uppercase (MAC convention) and don't need triggers.

-- Drop triggers on app.networks
DROP TRIGGER IF EXISTS trigger_uppercase_ssid_networks ON app.networks;

-- Drop triggers on public schema tables (if they exist)
DROP TRIGGER IF EXISTS trigger_uppercase_ssid ON public.access_points;
DROP TRIGGER IF EXISTS trigger_uppercase_ssid_observations ON public.observations;
DROP TRIGGER IF EXISTS trigger_uppercase_ssid_history ON public.ssid_history;

-- Drop the trigger functions
DROP FUNCTION IF EXISTS app.uppercase_ssid_trigger() CASCADE;
DROP FUNCTION IF EXISTS public.uppercase_ssid_trigger() CASCADE;
