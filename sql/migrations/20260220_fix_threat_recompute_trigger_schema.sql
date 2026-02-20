-- Fix: trigger function references public.threat_scores_cache but table lives in app schema.
-- The consolidated_005 migration was seeded as applied without actually executing,
-- so the live trigger function still has the old schema reference.

-- Fix the trigger function to use app.threat_scores_cache
CREATE OR REPLACE FUNCTION public.mark_network_for_threat_recompute()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
    INSERT INTO app.threat_scores_cache (bssid, needs_recompute)
    VALUES (NEW.bssid, TRUE)
    ON CONFLICT (bssid) DO UPDATE SET needs_recompute = TRUE;
    RETURN NEW;
END;
$function$;

-- Drop the manually-created public workaround table (app schema is canonical)
DROP TABLE IF EXISTS public.threat_scores_cache;
