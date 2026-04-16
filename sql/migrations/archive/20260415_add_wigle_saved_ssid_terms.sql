-- Migration: create wigle_saved_ssid_terms for persisting deduplicated SSID search history

CREATE TABLE IF NOT EXISTS app.wigle_saved_ssid_terms (
    id           bigserial   PRIMARY KEY,
    term         text        NOT NULL,
    term_normalized text     NOT NULL,
    created_at   timestamptz NOT NULL DEFAULT now(),
    last_used_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS wigle_saved_ssid_terms_normalized_idx
    ON app.wigle_saved_ssid_terms (term_normalized);

-- Backfill: seed from existing import runs, keeping most recently-used variant.
-- Excludes: blank, ≤2 chars, pure country codes, "% bi%" patterns.
INSERT INTO app.wigle_saved_ssid_terms (term, term_normalized)
SELECT DISTINCT ON (lower(trim(search_term)))
       trim(search_term)        AS term,
       lower(trim(search_term)) AS term_normalized
  FROM app.wigle_import_runs
 WHERE search_term IS NOT NULL
   AND length(trim(search_term)) >= 3
   AND lower(trim(search_term)) NOT IN ('us', 'uk', 'ca', 'au', 'de', 'fr', 'jp')
   AND trim(search_term) NOT LIKE '% bi%'
   AND trim(search_term) !~ '^\s*$'
 ORDER BY lower(trim(search_term)), started_at DESC
ON CONFLICT (term_normalized) DO NOTHING;
