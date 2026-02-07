# FBI Field Offices + Resident Agencies + Training Facilities

## Goal

Maintain a public, auditable dataset of FBI offices (field offices, resident agencies, and training facilities) in `app.agency_offices`, with provenance (`source_url`, `source_status`) and optional geocoding.

## Canonical Table

`app.agency_offices`

Key columns:

- `agency` (text) — e.g., `FBI`
- `office_type` (text) — `field_office`, `resident_agency`, `training_facility`
- `name`, `parent_office`
- `address_line1`, `address_line2`, `city`, `state`, `postal_code`
- `phone`, `website`, `jurisdiction`
- `latitude`, `longitude`, `location` (geography)
- `source_url`, `source_retrieved_at`, `source_status`

## Current Status (as of 2026-02-06)

Counts for `agency = 'FBI'`:

- `field_office`: 56 total, 0 missing address, 56 missing coordinates
- `resident_agency`: 355 total, 249 missing address, 355 missing coordinates
- `training_facility`: 1 total, 0 missing address, 1 missing coordinates

Source status distribution:

- `verified`: 315
- `unverified`: 89
- `legacy_needs_verification`: 8

## Data Sources (Public Only)

Use official FBI `.gov` pages as primary sources. Each row should have:

- `source_url` (page used to populate the record)
- `source_retrieved_at` (timestamp)
- `source_status` set to `verified` only when the address was obtained from a primary FBI page

Secondary sources (e.g., local government pages or maps) should only be used for confirmation; if used, mark `source_status` as `unverified` and keep `source_url` pointing to the official FBI page.

## Ingestion / Update Process

1. **Gather source pages**
   - Field offices list
   - Resident agencies list (often nested under field office pages)
   - Training facilities (e.g., Quantico)

2. **Normalize fields**
   - Split address into `address_line1`, `address_line2`, `city`, `state`, `postal_code`
   - Normalize `office_type` to one of:
     - `field_office`
     - `resident_agency`
     - `training_facility`
   - For resident agencies, set `parent_office` to the field office name

3. **Upsert into `app.agency_offices`**
   - Uniqueness is enforced by `(agency, office_type, name, city, state)`
   - Keep `source_url` and `source_retrieved_at` updated

4. **Geocode (later pass)**
   - Populate `latitude`, `longitude`, and `location` once address quality is acceptable
   - Keep `source_status` as `verified` only if address provenance is primary

## QA Queries

Check address gaps:

```sql
SELECT office_type,
       count(*) AS total,
       count(*) FILTER (WHERE address_line1 IS NULL OR trim(address_line1) = '') AS missing_address,
       count(*) FILTER (WHERE latitude IS NULL OR longitude IS NULL) AS missing_coords
FROM app.agency_offices
WHERE agency = 'FBI'
GROUP BY office_type
ORDER BY office_type;
```

Check source status distribution:

```sql
SELECT source_status, count(*)
FROM app.agency_offices
WHERE agency = 'FBI'
GROUP BY source_status
ORDER BY source_status;
```

Find records missing parent office:

```sql
SELECT id, name, city, state
FROM app.agency_offices
WHERE agency = 'FBI'
  AND office_type = 'resident_agency'
  AND (parent_office IS NULL OR trim(parent_office) = '');
```

## Next Steps (Recommended)

1. **Address completion for resident agencies**
   - Prioritize official FBI sources
   - Backfill `address_line1/city/state/postal_code`
2. **Geocode once addresses are complete**
   - Populate `latitude`, `longitude`, `location`
3. **Review `source_status`**
   - Promote to `verified` only when confirmed by FBI source
   - Keep secondary‑only entries as `unverified`

## Notes

- Do not mix data from non‑public or restricted sources.
- Always keep `source_url` and `source_retrieved_at` updated for provenance.
