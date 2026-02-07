-- Batch 26: Fill missing resident-agency phone numbers from their parent field office phone.
-- This is a fallback when we can't find a reliable non-FBI listing for the resident agency itself.
-- We leave source_url/source_status unchanged to avoid claiming a non-FBI source for the derived value.

BEGIN;

WITH placeholders(name) AS (
  VALUES
    ('Areas covered'),
    ('City covered'),
    ('Counties and cities covered'),
    ('Counties and city covered'),
    ('Municipalities covered'),
    ('Parishes covered'),
    ('Counties covered'),
    ('Cities covered'),
    ('County and cities covered'),
    ('Counties/cities covered'),
    ('North'),
    ('South'),
    ('East'),
    ('West'),
    ('Iowa'),
    ('Nebraska')
),
targets AS (
  SELECT
    ao.id,
    fo.phone AS parent_phone
  FROM app.agency_offices ao
  JOIN app.agency_offices fo
    ON fo.agency = ao.agency
   AND fo.office_type = 'field_office'
   AND fo.name = ao.parent_office
  WHERE ao.agency = 'FBI'
    AND ao.office_type = 'resident_agency'
    AND NOT EXISTS (SELECT 1 FROM placeholders p WHERE p.name = ao.name)
    AND (ao.phone IS NULL OR BTRIM(ao.phone) = '')
    AND NULLIF(BTRIM(fo.phone), '') IS NOT NULL
)
UPDATE app.agency_offices ao
SET
  phone = t.parent_phone,
  updated_at = NOW()
FROM targets t
WHERE ao.id = t.id;

COMMIT;

