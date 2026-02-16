-- Create agency_offices table for public agency field offices / resident agencies

BEGIN;

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS app.agency_offices (
  id SERIAL PRIMARY KEY,
  agency TEXT NOT NULL,
  office_type TEXT NOT NULL CHECK (office_type IN ('field_office', 'resident_agency')),
  name TEXT NOT NULL,
  parent_office TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  phone TEXT,
  website TEXT,
  jurisdiction TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  location GEOGRAPHY(POINT, 4326),
  source_url TEXT,
  source_retrieved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (agency, office_type, name, city, state)
);

CREATE INDEX IF NOT EXISTS idx_agency_offices_agency ON app.agency_offices(agency);
CREATE INDEX IF NOT EXISTS idx_agency_offices_type ON app.agency_offices(office_type);
CREATE INDEX IF NOT EXISTS idx_agency_offices_state ON app.agency_offices(state);
CREATE INDEX IF NOT EXISTS idx_agency_offices_location ON app.agency_offices USING GIST(location);

COMMENT ON TABLE app.agency_offices IS 'Public agency offices (field offices, resident agencies) with contact and jurisdiction data.';

COMMIT;
