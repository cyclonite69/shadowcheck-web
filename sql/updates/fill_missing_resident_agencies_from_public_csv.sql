-- Fill missing FBI resident-agency contact fields from a curated public-listings CSV.
-- Safety rules:
-- - Only fills fields when the existing value is NULL/blank.
-- - Never overwrites existing non-blank address/phone fields.
-- - Preserves the current source_url by copying it into website (website is empty for RAs today),
--   then overwrites source_url/source_status for provenance of the newly-filled contact info.
--
-- Usage (from host):
--   docker cp data/csv/FILE.csv shadowcheck_postgres:/tmp/fbi_resident_agencies_public_batch.csv
--   docker exec -i shadowcheck_postgres psql -U shadowcheck_user -d shadowcheck_db \
--     -v ON_ERROR_STOP=1 \
--     -f /tmp/fill_missing_resident_agencies_from_public_csv.sql
--
-- CSV header (required):
--   name,city,state,address_line1,address_line2,postal_code,phone,parent_office,source_url,source_retrieved_at

\set ON_ERROR_STOP on

BEGIN;

CREATE TEMP TABLE tmp_ra_public_enrich (
  name text NOT NULL,
  city text,
  state text NOT NULL,
  address_line1 text,
  address_line2 text,
  postal_code text,
  phone text,
  parent_office text,
  source_url text NOT NULL,
  source_retrieved_at text
) ON COMMIT DROP;

-- NOTE: psql variable substitution inside \copy is finicky across environments; we expect the
-- batch CSV to be copied to this fixed path in the postgres container.
\copy tmp_ra_public_enrich (name,city,state,address_line1,address_line2,postal_code,phone,parent_office,source_url,source_retrieved_at) FROM '/tmp/fbi_resident_agencies_public_batch.csv' WITH (FORMAT csv, HEADER true);

-- Report rows that do not match an existing RA (by name+state).
-- We do not insert new offices here.
SELECT
  COUNT(*) AS csv_rows,
  COUNT(*) FILTER (WHERE ao.id IS NULL) AS csv_unmatched_rows
FROM tmp_ra_public_enrich t
LEFT JOIN app.agency_offices ao
  ON ao.agency = 'FBI'
 AND ao.office_type = 'resident_agency'
 AND ao.name = t.name
 AND ao.state = t.state;

WITH updated AS (
  UPDATE app.agency_offices ao
  SET
    address_line1 = CASE
      WHEN NULLIF(BTRIM(ao.address_line1), '') IS NULL THEN NULLIF(BTRIM(t.address_line1), '')
      ELSE ao.address_line1
    END,
    address_line2 = CASE
      WHEN NULLIF(BTRIM(ao.address_line2), '') IS NULL THEN NULLIF(BTRIM(t.address_line2), '')
      ELSE ao.address_line2
    END,
    postal_code = CASE
      WHEN NULLIF(BTRIM(ao.postal_code), '') IS NULL THEN NULLIF(BTRIM(t.postal_code), '')
      ELSE ao.postal_code
    END,
    phone = CASE
      WHEN NULLIF(BTRIM(ao.phone), '') IS NULL THEN NULLIF(BTRIM(t.phone), '')
      ELSE ao.phone
    END,
    -- Fill these only if missing; do not overwrite.
    parent_office = CASE
      WHEN NULLIF(BTRIM(ao.parent_office), '') IS NULL THEN NULLIF(BTRIM(t.parent_office), '')
      ELSE ao.parent_office
    END,
    city = CASE
      WHEN NULLIF(BTRIM(ao.city), '') IS NULL THEN NULLIF(BTRIM(t.city), '')
      ELSE ao.city
    END,
    -- Preserve the existing official link before overwriting provenance.
    website = CASE
      WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url
      ELSE ao.website
    END,
    source_url = t.source_url,
    source_retrieved_at = NULLIF(BTRIM(t.source_retrieved_at), '')::timestamp,
    source_status = 'unverified',
    updated_at = NOW()
  FROM tmp_ra_public_enrich t
  WHERE ao.agency = 'FBI'
    AND ao.office_type = 'resident_agency'
    AND ao.name = t.name
    AND ao.state = t.state
    AND (
      (NULLIF(BTRIM(ao.address_line1), '') IS NULL AND NULLIF(BTRIM(t.address_line1), '') IS NOT NULL)
      OR (NULLIF(BTRIM(ao.address_line2), '') IS NULL AND NULLIF(BTRIM(t.address_line2), '') IS NOT NULL)
      OR (NULLIF(BTRIM(ao.postal_code), '') IS NULL AND NULLIF(BTRIM(t.postal_code), '') IS NOT NULL)
      OR (NULLIF(BTRIM(ao.phone), '') IS NULL AND NULLIF(BTRIM(t.phone), '') IS NOT NULL)
    )
  RETURNING ao.id
)
SELECT COUNT(*) AS updated_rows FROM updated;

COMMIT;
