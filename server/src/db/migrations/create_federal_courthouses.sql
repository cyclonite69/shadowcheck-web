-- Phase 1: Create Table
CREATE TABLE IF NOT EXISTS app.federal_courthouses (
  id                    SERIAL PRIMARY KEY,
  name                  TEXT NOT NULL,          -- full official name
  short_name            TEXT,                   -- common name
  courthouse_type       TEXT NOT NULL,          -- see CHECK below
  district              TEXT NOT NULL,          -- e.g. "Northern District of California"
  circuit               TEXT NOT NULL,          -- e.g. "Ninth Circuit"
  address_line1         TEXT,
  address_line2         TEXT,
  city                  TEXT NOT NULL,
  state                 TEXT NOT NULL,          -- 2-char abbreviation
  postal_code           TEXT,
  latitude              DOUBLE PRECISION,
  longitude             DOUBLE PRECISION,
  location              GEOGRAPHY(Point,4326),  -- match agency_offices convention
  active                BOOLEAN NOT NULL DEFAULT TRUE,
  notes                 TEXT,
  source_url            TEXT,
  created_at            TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  updated_at            TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  CONSTRAINT federal_courthouses_type_check CHECK (
    courthouse_type = ANY (ARRAY[
      'district_court',
      'circuit_court_of_appeals',
      'bankruptcy_court',
      'magistrate_court',
      'specialty_court'
    ])
  )
);

-- Spatial index matching agency_offices convention
CREATE INDEX IF NOT EXISTS idx_federal_courthouses_location
  ON app.federal_courthouses USING GIST (location);

-- Lookup indexes
CREATE INDEX IF NOT EXISTS idx_federal_courthouses_state
  ON app.federal_courthouses (state);
CREATE INDEX IF NOT EXISTS idx_federal_courthouses_district
  ON app.federal_courthouses (district);
CREATE INDEX IF NOT EXISTS idx_federal_courthouses_circuit
  ON app.federal_courthouses (circuit);
CREATE INDEX IF NOT EXISTS idx_federal_courthouses_type
  ON app.federal_courthouses (courthouse_type);

-- Auto-populate location from lat/lng on insert/update
CREATE OR REPLACE FUNCTION app.update_courthouse_location()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.location = ST_SetSRID(
      ST_MakePoint(NEW.longitude, NEW.latitude),
      4326
    )::GEOGRAPHY;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS courthouse_location_trigger ON app.federal_courthouses;
CREATE TRIGGER courthouse_location_trigger
  BEFORE INSERT OR UPDATE ON app.federal_courthouses
  FOR EACH ROW EXECUTE FUNCTION app.update_courthouse_location();

-- Grant read access to grafana_reader
GRANT SELECT ON app.federal_courthouses TO grafana_reader;

-- Phase 2: Populate Data
TRUNCATE app.federal_courthouses;

INSERT INTO app.federal_courthouses 
  (name, short_name, courthouse_type, district, circuit, address_line1, city, state, postal_code, latitude, longitude, notes)
VALUES
  -- FIRST CIRCUIT
  ('Edward T. Gignoux United States Courthouse', 'District of Maine - Portland', 'district_court', 'District of Maine', 'First Circuit', '156 Federal Street', 'Portland', 'ME', '04101', 43.6591, -70.2568, 'Main courthouse for District of Maine'),
  ('United States Courthouse', 'District of Maine - Bangor', 'district_court', 'District of Maine', 'First Circuit', '202 Harlow Street', 'Bangor', 'ME', '04401', 44.8041, -68.7712, 'Divisional courthouse'),
  ('John Joseph Moakley United States Courthouse', 'First Circuit - Boston', 'circuit_court_of_appeals', 'First Circuit', 'First Circuit', '1 Courthouse Way', 'Boston', 'MA', '02210', 42.3541, -71.0428, 'Seat of the First Circuit Court of Appeals'),
  ('John Joseph Moakley United States Courthouse', 'District of Massachusetts - Boston', 'district_court', 'District of Massachusetts', 'First Circuit', '1 Courthouse Way', 'Boston', 'MA', '02210', 42.3541, -71.0428, 'Main district courthouse'),
  ('Donohue Federal Building and United States Courthouse', 'District of Massachusetts - Worcester', 'district_court', 'District of Massachusetts', 'First Circuit', '595 Main Street', 'Worcester', 'MA', '01608', 42.2625, -71.8023, 'Divisional courthouse'),
  ('Springfield Federal Building and United States Courthouse', 'District of Massachusetts - Springfield', 'district_court', 'District of Massachusetts', 'First Circuit', '300 State Street', 'Springfield', 'MA', '01105', 42.1015, -72.5836, 'Divisional courthouse'),
  ('Warren B. Rudman United States Courthouse', 'District of New Hampshire - Concord', 'district_court', 'District of New Hampshire', 'First Circuit', '55 Pleasant Street', 'Concord', 'NH', '03301', 43.2044, -71.5366, 'Main courthouse'),
  ('Federico Degetau Federal Building and United States Courthouse', 'District of Puerto Rico - Hato Rey', 'district_court', 'District of Puerto Rico', 'First Circuit', '150 Carlos Chardon Avenue', 'San Juan', 'PR', '00918', 18.4275, -66.0642, 'Main district courthouse'),
  ('Jose V. Toledo United States Post Office and Courthouse', 'District of Puerto Rico - Old San Juan', 'bankruptcy_court', 'District of Puerto Rico', 'First Circuit', '300 Recinto Sur Street', 'San Juan', 'PR', '00901', 18.4647, -66.1165, 'Historic courthouse'),
  ('United States Courthouse', 'District of Rhode Island - Providence', 'district_court', 'District of Rhode Island', 'First Circuit', '1 Exchange Terrace', 'Providence', 'RI', '02903', 41.8240, -71.4128, 'Main district courthouse'),

  -- SECOND CIRCUIT
  ('Richard C. Lee United States Courthouse', 'District of Connecticut - New Haven', 'district_court', 'District of Connecticut', 'Second Circuit', '141 Church Street', 'New Haven', 'CT', '06510', 41.3082, -72.9250, 'Main district courthouse'),
  ('Abraham A. Ribicoff Federal Building and United States Courthouse', 'District of Connecticut - Hartford', 'district_court', 'District of Connecticut', 'Second Circuit', '450 Main Street', 'Hartford', 'CT', '06103', 41.7637, -72.6740, 'Divisional courthouse'),
  ('Brien McMahon Federal Building and United States Courthouse', 'District of Connecticut - Bridgeport', 'district_court', 'District of Connecticut', 'Second Circuit', '915 Lafayette Boulevard', 'Bridgeport', 'CT', '06604', 41.1792, -73.1938, 'Divisional courthouse'),
  ('James T. Foley United States Courthouse', 'Northern District of New York - Albany', 'district_court', 'Northern District of New York', 'Second Circuit', '445 Broadway', 'Albany', 'NY', '12207', 42.6526, -73.7562, 'Main district courthouse'),
  ('Hanley Federal Building and United States Courthouse', 'Northern District of New York - Syracuse', 'district_court', 'Northern District of New York', 'Second Circuit', '100 South Clinton Street', 'Syracuse', 'NY', '13261', 43.0481, -76.1500, 'Divisional courthouse'),
  ('Thurgood Marshall United States Courthouse', 'Second Circuit - Manhattan', 'circuit_court_of_appeals', 'Second Circuit', 'Second Circuit', '40 Foley Square', 'New York', 'NY', '10007', 40.7143, -74.0055, 'Seat of the Second Circuit Court of Appeals'),
  ('Daniel Patrick Moynihan United States Courthouse', 'Southern District of New York - Manhattan', 'district_court', 'Southern District of New York', 'Second Circuit', '500 Pearl Street', 'New York', 'NY', '10007', 40.7140, -74.0020, 'Main district courthouse for SDNY'),
  ('Charles L. Brieant Jr. Federal Building and United States Courthouse', 'Southern District of New York - White Plains', 'district_court', 'Southern District of New York', 'Second Circuit', '300 Quarropas Street', 'White Plains', 'NY', '10601', 41.0330, -73.7620, 'SDNY White Plains division'),
  ('Theodore Roosevelt United States Courthouse', 'Eastern District of New York - Brooklyn', 'district_court', 'Eastern District of New York', 'Second Circuit', '225 Cadman Plaza East', 'Brooklyn', 'NY', '11201', 40.6940, -73.9900, 'Main district courthouse for EDNY'),
  ('Alphonse M. D''Amato United States Courthouse', 'Eastern District of New York - Central Islip', 'district_court', 'Eastern District of New York', 'Second Circuit', '100 Federal Plaza', 'Central Islip', 'NY', '11722', 40.7600, -73.2000, 'EDNY Long Island division'),
  ('Robert H. Jackson United States Courthouse', 'Western District of New York - Buffalo', 'district_court', 'Western District of New York', 'Second Circuit', '2 Niagara Square', 'Buffalo', 'NY', '14202', 42.8860, -78.8780, 'Main district courthouse'),
  ('Kenneth B. Keating Federal Building and United States Courthouse', 'Western District of New York - Rochester', 'district_court', 'Western District of New York', 'Second Circuit', '100 State Street', 'Rochester', 'NY', '14614', 43.1566, -77.6088, 'Divisional courthouse'),
  ('United States Post Office and Courthouse', 'District of Vermont - Burlington', 'district_court', 'District of Vermont', 'Second Circuit', '11 Elmwood Avenue', 'Burlington', 'VT', '05401', 44.4759, -73.2121, 'Main district courthouse'),
  ('United States Post Office and Courthouse', 'District of Vermont - Rutland', 'district_court', 'District of Vermont', 'Second Circuit', '151 West Street', 'Rutland', 'VT', '05701', 43.6067, -72.9781, 'Divisional courthouse'),

  -- THIRD CIRCUIT
  ('J. Caleb Boggs Federal Building and United States Courthouse', 'District of Delaware - Wilmington', 'district_court', 'District of Delaware', 'Third Circuit', '844 North King Street', 'Wilmington', 'DE', '19801', 39.7459, -75.5466, 'Main district courthouse'),
  ('Mitchell H. Cohen United States Courthouse', 'District of New Jersey - Camden', 'district_court', 'District of New Jersey', 'Third Circuit', '400 Cooper Street', 'Camden', 'NJ', '08102', 39.9440, -75.1200, 'Divisional courthouse'),
  ('Martin Luther King Jr. Federal Building and United States Courthouse', 'District of New Jersey - Newark', 'district_court', 'District of New Jersey', 'Third Circuit', '50 Walnut Street', 'Newark', 'NJ', '07102', 40.7357, -74.1724, 'Main district courthouse'),
  ('Clarkson S. Fisher Federal Building and United States Courthouse', 'District of New Jersey - Trenton', 'district_court', 'District of New Jersey', 'Third Circuit', '402 East State Street', 'Trenton', 'NJ', '08608', 40.2206, -74.7597, 'Divisional courthouse'),
  ('James A. Byrne United States Courthouse', 'Third Circuit - Philadelphia', 'circuit_court_of_appeals', 'Third Circuit', 'Third Circuit', '601 Market Street', 'Philadelphia', 'PA', '19106', 39.9510, -75.1510, 'Seat of the Third Circuit Court of Appeals'),
  ('James A. Byrne United States Courthouse', 'Eastern District of Pennsylvania - Philadelphia', 'district_court', 'Eastern District of Pennsylvania', 'Third Circuit', '601 Market Street', 'Philadelphia', 'PA', '19106', 39.9510, -75.1510, 'Main district courthouse'),
  ('Edward N. Cahn Federal Building and United States Courthouse', 'Eastern District of Pennsylvania - Allentown', 'district_court', 'Eastern District of Pennsylvania', 'Third Circuit', '504 West Hamilton Street', 'Allentown', 'PA', '18101', 40.6020, -75.4710, 'Divisional courthouse'),
  ('Sylvia H. Rambo United States Courthouse', 'Middle District of Pennsylvania - Harrisburg', 'district_court', 'Middle District of Pennsylvania', 'Third Circuit', '1501 North Sixth Street', 'Harrisburg', 'PA', '17102', 40.2737, -76.8844, 'Main district courthouse'),
  ('William J. Nealon Federal Building and United States Courthouse', 'Middle District of Pennsylvania - Scranton', 'district_court', 'Middle District of Pennsylvania', 'Third Circuit', '235 North Washington Avenue', 'Scranton', 'PA', '18503', 41.4089, -75.6624, 'Divisional courthouse'),
  ('Max Rosenn United States Courthouse', 'Middle District of Pennsylvania - Wilkes-Barre', 'district_court', 'Middle District of Pennsylvania', 'Third Circuit', '197 South Main Street', 'Wilkes-Barre', 'PA', '18701', 41.2459, -75.8812, 'Divisional courthouse'),
  ('Joseph F. Weis Jr. United States Courthouse', 'Western District of Pennsylvania - Pittsburgh', 'district_court', 'Western District of Pennsylvania', 'Third Circuit', '700 Grant Street', 'Pittsburgh', 'PA', '15219', 40.4406, -79.9959, 'Main district courthouse'),
  ('Erie Federal Courthouse and Post Office', 'Western District of Pennsylvania - Erie', 'district_court', 'Western District of Pennsylvania', 'Third Circuit', '17 South Park Row', 'Erie', 'PA', '16501', 42.1292, -80.0853, 'Divisional courthouse'),
  ('Almeric L. Christian Federal Building and United States Courthouse', 'District of the Virgin Islands - St. Croix', 'district_court', 'District of the Virgin Islands', 'Third Circuit', '3013 Estate Golden Rock', 'Christiansted', 'VI', '00820', 17.7466, -64.7032, 'Main district courthouse for St. Croix'),
  ('Ron de Lugo Federal Building and United States Courthouse', 'District of the Virgin Islands - St. Thomas', 'district_court', 'District of the Virgin Islands', 'Third Circuit', '5500 Veterans Drive', 'St. Thomas', 'VI', '00802', 18.3419, -64.9307, 'Main district courthouse for St. Thomas'),

  -- FOURTH CIRCUIT
  ('Edward A. Garmatz United States District Courthouse', 'District of Maryland - Baltimore', 'district_court', 'District of Maryland', 'Fourth Circuit', '101 West Lombard Street', 'Baltimore', 'MD', '21201', 39.2875, -76.6167, 'Main district courthouse'),
  ('United States Courthouse', 'District of Maryland - Greenbelt', 'district_court', 'District of Maryland', 'Fourth Circuit', '6500 Cherrywood Lane', 'Greenbelt', 'MD', '20770', 39.0089, -76.8981, 'Divisional courthouse'),
  ('Terry Sanford Federal Building and United States Courthouse', 'Eastern District of North Carolina - Raleigh', 'district_court', 'Eastern District of North Carolina', 'Fourth Circuit', '310 New Bern Avenue', 'Raleigh', 'NC', '27601', 35.7806, -78.6389, 'Main district courthouse'),
  ('United States Courthouse', 'Middle District of North Carolina - Greensboro', 'district_court', 'Middle District of North Carolina', 'Fourth Circuit', '324 West Market Street', 'Greensboro', 'NC', '27401', 36.0726, -79.7920, 'Main district courthouse'),
  ('Charles R. Jonas Federal Building and United States Courthouse', 'Western District of North Carolina - Charlotte', 'district_court', 'Western District of North Carolina', 'Fourth Circuit', '401 West Trade Street', 'Charlotte', 'NC', '28202', 35.2271, -80.8431, 'Main district courthouse'),
  ('Matthew J. Perry Jr. United States Courthouse', 'District of South Carolina - Columbia', 'district_court', 'District of South Carolina', 'Fourth Circuit', '901 Richland Street', 'Columbia', 'SC', '29201', 34.0007, -81.0348, 'Main district courthouse'),
  ('Lewis F. Powell Jr. United States Courthouse', 'Fourth Circuit - Richmond', 'circuit_court_of_appeals', 'Fourth Circuit', 'Fourth Circuit', '1000 East Main Street', 'Richmond', 'VA', '23219', 37.5407, -77.4360, 'Seat of the Fourth Circuit Court of Appeals'),
  ('Spottswood W. Robinson III and Robert R. Merhige Jr. United States Courthouse', 'Eastern District of Virginia - Richmond', 'district_court', 'Eastern District of Virginia', 'Fourth Circuit', '701 East Broad Street', 'Richmond', 'VA', '23219', 37.5430, -77.4340, 'Main district courthouse'),
  ('Albert V. Bryan United States Courthouse', 'Eastern District of Virginia - Alexandria', 'district_court', 'Eastern District of Virginia', 'Fourth Circuit', '401 Courthouse Square', 'Alexandria', 'VA', '22314', 38.8048, -77.0469, 'Divisional courthouse'),
  ('Walter E. Hoffman United States Courthouse', 'Eastern District of Virginia - Norfolk', 'district_court', 'Eastern District of Virginia', 'Fourth Circuit', '600 Granby Street', 'Norfolk', 'VA', '23510', 36.8508, -76.2859, 'Divisional courthouse'),
  ('Richard H. Poff Federal Building', 'Western District of Virginia - Roanoke', 'district_court', 'Western District of Virginia', 'Fourth Circuit', '210 Franklin Road SW', 'Roanoke', 'VA', '24011', 37.2710, -79.9414, 'Main district courthouse'),
  ('Robert C. Byrd United States Courthouse', 'Southern District of West Virginia - Charleston', 'district_court', 'Southern District of West Virginia', 'Fourth Circuit', '300 Virginia Street East', 'Charleston', 'WV', '25301', 38.3498, -81.6326, 'Main district courthouse'),
  ('W. Craig Broadwater Federal Building and United States Courthouse', 'Northern District of West Virginia - Martinsburg', 'district_court', 'Northern District of West Virginia', 'Fourth Circuit', '217 West King Street', 'Martinsburg', 'WV', '25401', 39.4562, -77.9639, 'Main district courthouse'),

  -- FIFTH CIRCUIT
  ('John Minor Wisdom United States Court of Appeals Building', 'Fifth Circuit - New Orleans', 'circuit_court_of_appeals', 'Fifth Circuit', 'Fifth Circuit', '600 Camp Street', 'New Orleans', 'LA', '70130', 29.9490, -90.0700, 'Seat of the Fifth Circuit Court of Appeals'),
  ('Hale Boggs Federal Building and United States Courthouse', 'Eastern District of Louisiana - New Orleans', 'district_court', 'Eastern District of Louisiana', 'Fifth Circuit', '500 Poydras Street', 'New Orleans', 'LA', '70130', 29.9480, -90.0670, 'Main district courthouse'),
  ('Russell B. Long Federal Building and United States Courthouse', 'Middle District of Louisiana - Baton Rouge', 'district_court', 'Middle District of Louisiana', 'Fifth Circuit', '777 Florida Street', 'Baton Rouge', 'LA', '70801', 30.4507, -91.1871, 'Main district courthouse'),
  ('Tom Stagg United States Court House', 'Western District of Louisiana - Shreveport', 'district_court', 'Western District of Louisiana', 'Fifth Circuit', '300 Fannin Street', 'Shreveport', 'LA', '71101', 32.5122, -93.7503, 'Main district courthouse'),
  ('Thad Cochran United States Courthouse', 'Southern District of Mississippi - Jackson', 'district_court', 'Southern District of Mississippi', 'Fifth Circuit', '501 East Court Street', 'Jackson', 'MS', '39201', 32.2989, -90.1847, 'Main district courthouse'),
  ('William M. Colmer Federal Building and United States Courthouse', 'Southern District of Mississippi - Hattiesburg', 'district_court', 'Southern District of Mississippi', 'Fifth Circuit', '701 North Main Street', 'Hattiesburg', 'MS', '39401', 31.3271, -89.2903, 'Divisional courthouse'),
  ('United States Courthouse', 'Northern District of Mississippi - Oxford', 'district_court', 'Northern District of Mississippi', 'Fifth Circuit', '911 Jackson Avenue East', 'Oxford', 'MS', '38655', 34.3662, -89.5186, 'Main district courthouse'),
  ('Earle Cabell Federal Building and United States Courthouse', 'Northern District of Texas - Dallas', 'district_court', 'Northern District of Texas', 'Fifth Circuit', '1100 Commerce Street', 'Dallas', 'TX', '75242', 32.7794, -96.8011, 'Main district courthouse'),
  ('Eldon B. Mahon United States Courthouse', 'Northern District of Texas - Fort Worth', 'district_court', 'Northern District of Texas', 'Fifth Circuit', '501 West 10th Street', 'Fort Worth', 'TX', '76102', 32.7508, -97.3331, 'Divisional courthouse'),
  ('Bob Casey United States Courthouse', 'Southern District of Texas - Houston', 'district_court', 'Southern District of Texas', 'Fifth Circuit', '515 Rusk Street', 'Houston', 'TX', '77002', 29.7604, -95.3698, 'Main district courthouse'),
  ('United States Courthouse', 'Southern District of Texas - Galveston', 'district_court', 'Southern District of Texas', 'Fifth Circuit', '601 25th Street', 'Galveston', 'TX', '77550', 29.3013, -94.7936, 'Historic divisional courthouse'),
  ('Jack Brooks Federal Building and United States Courthouse', 'Eastern District of Texas - Beaumont', 'district_court', 'Eastern District of Texas', 'Fifth Circuit', '300 Willow Street', 'Beaumont', 'TX', '77701', 30.0841, -94.1014, 'Main district courthouse'),
  ('William M. Steger Federal Building and United States Courthouse', 'Eastern District of Texas - Tyler', 'district_court', 'Eastern District of Texas', 'Fifth Circuit', '211 West Ferguson Street', 'Tyler', 'TX', '75702', 32.3513, -95.3011, 'Divisional courthouse'),
  ('John H. Wood Jr. United States Courthouse', 'Western District of Texas - San Antonio', 'district_court', 'Western District of Texas', 'Fifth Circuit', '262 West Nueva Street', 'San Antonio', 'TX', '78207', 29.4241, -98.4936, 'Main district courthouse'),
  ('United States Courthouse', 'Western District of Texas - Austin', 'district_court', 'Western District of Texas', 'Fifth Circuit', '501 West 5th Street', 'Austin', 'TX', '78701', 30.2672, -97.7431, 'Divisional courthouse'),
  ('Albert Armendariz Sr. United States Courthouse', 'Western District of Texas - El Paso', 'district_court', 'Western District of Texas', 'Fifth Circuit', '525 Magoffin Avenue', 'El Paso', 'TX', '79901', 31.7587, -106.4869, 'Divisional courthouse'),

  -- SIXTH CIRCUIT
  ('Potter Stewart United States Courthouse', 'Sixth Circuit - Cincinnati', 'circuit_court_of_appeals', 'Sixth Circuit', 'Sixth Circuit', '100 East Fifth Street', 'Cincinnati', 'OH', '45202', 39.1015, -84.5125, 'Seat of the Sixth Circuit Court of Appeals'),
  ('Potter Stewart United States Courthouse', 'Southern District of Ohio - Cincinnati', 'district_court', 'Southern District of Ohio', 'Sixth Circuit', '100 East Fifth Street', 'Cincinnati', 'OH', '45202', 39.1015, -84.5125, 'Main district courthouse'),
  ('Joseph P. Kinneary United States Courthouse', 'Southern District of Ohio - Columbus', 'district_court', 'Southern District of Ohio', 'Sixth Circuit', '85 Marconi Boulevard', 'Columbus', 'OH', '43215', 39.9612, -83.0030, 'Divisional courthouse'),
  ('Carl B. Stokes United States Courthouse', 'Northern District of Ohio - Cleveland', 'district_court', 'Northern District of Ohio', 'Sixth Circuit', '801 West Superior Avenue', 'Cleveland', 'OH', '44113', 41.4993, -81.6944, 'Main district courthouse'),
  ('Gene Snyder United States Courthouse', 'Western District of Kentucky - Louisville', 'district_court', 'Western District of Kentucky', 'Sixth Circuit', '601 West Broadway', 'Louisville', 'KY', '40202', 38.2527, -85.7585, 'Main district courthouse'),
  ('Frank M. Scarlett Federal Building', 'Eastern District of Kentucky - Lexington', 'district_court', 'Eastern District of Kentucky', 'Sixth Circuit', '101 Barr Street', 'Lexington', 'KY', '40507', 38.0406, -84.5037, 'Main district courthouse'),
  ('Theodore Levin United States Courthouse', 'Eastern District of Michigan - Detroit', 'district_court', 'Eastern District of Michigan', 'Sixth Circuit', '231 West Lafayette Boulevard', 'Detroit', 'MI', '48226', 42.3314, -83.0458, 'Main district courthouse'),
  ('Gerald R. Ford Federal Building and United States Courthouse', 'Western District of Michigan - Grand Rapids', 'district_court', 'Western District of Michigan', 'Sixth Circuit', '110 Michigan Street NW', 'Grand Rapids', 'MI', '49503', 42.9634, -85.6681, 'Main district courthouse'),
  ('Fred D. Thompson United States Courthouse and Federal Building', 'Middle District of Tennessee - Nashville', 'district_court', 'Middle District of Tennessee', 'Sixth Circuit', '719 Church Street', 'Nashville', 'TN', '37203', 36.1627, -86.7816, 'Main district courthouse'),
  ('Clifford Davis and Odell Horton Federal Building', 'Western District of Tennessee - Memphis', 'district_court', 'Western District of Tennessee', 'Sixth Circuit', '167 North Main Street', 'Memphis', 'TN', '38103', 35.1495, -90.0490, 'Main district courthouse'),
  ('Howard H. Baker Jr. United States Courthouse', 'Eastern District of Tennessee - Knoxville', 'district_court', 'Eastern District of Tennessee', 'Sixth Circuit', '800 Market Street', 'Knoxville', 'TN', '37902', 35.9606, -83.9207, 'Main district courthouse'),

  -- SEVENTH CIRCUIT
  ('Everett McKinley Dirksen United States Courthouse', 'Seventh Circuit - Chicago', 'circuit_court_of_appeals', 'Seventh Circuit', 'Seventh Circuit', '219 South Dearborn Street', 'Chicago', 'IL', '60604', 41.8781, -87.6298, 'Seat of the Seventh Circuit Court of Appeals'),
  ('Everett McKinley Dirksen United States Courthouse', 'Northern District of Illinois - Chicago', 'district_court', 'Northern District of Illinois', 'Seventh Circuit', '219 South Dearborn Street', 'Chicago', 'IL', '60604', 41.8781, -87.6298, 'Main district courthouse'),
  ('Stanley J. Roszkowski United States Courthouse', 'Northern District of Illinois - Rockford', 'district_court', 'Northern District of Illinois', 'Seventh Circuit', '327 South Church Street', 'Rockford', 'IL', '61101', 42.2711, -89.0940, 'Divisional courthouse'),
  ('Paul Findley Federal Building and United States Courthouse', 'Central District of Illinois - Springfield', 'district_court', 'Central District of Illinois', 'Seventh Circuit', '600 East Monroe Street', 'Springfield', 'IL', '62701', 39.7999, -89.6461, 'Main district courthouse'),
  ('Melvin Price Federal Building and United States Courthouse', 'Southern District of Illinois - East St. Louis', 'district_court', 'Southern District of Illinois', 'Seventh Circuit', '750 Missouri Avenue', 'East St. Louis', 'IL', '62201', 38.6273, -90.1601, 'Main district courthouse'),
  ('Birch Bayh Federal Building and United States Courthouse', 'Southern District of Indiana - Indianapolis', 'district_court', 'Southern District of Indiana', 'Seventh Circuit', '46 East Ohio Street', 'Indianapolis', 'IN', '46204', 39.7684, -86.1581, 'Main district courthouse'),
  ('E. Ross Adair Federal Building and United States Courthouse', 'Northern District of Indiana - Fort Wayne', 'district_court', 'Northern District of Indiana', 'Seventh Circuit', '1300 South Harrison Street', 'Fort Wayne', 'IN', '46802', 41.0793, -85.1394, 'Main district courthouse'),
  ('Robert L. Miller Jr. United States Courthouse', 'Northern District of Indiana - South Bend', 'district_court', 'Northern District of Indiana', 'Seventh Circuit', '204 South Main Street', 'South Bend', 'IN', '46601', 41.6764, -86.2520, 'Divisional courthouse'),
  ('United States Courthouse', 'Eastern District of Wisconsin - Milwaukee', 'district_court', 'Eastern District of Wisconsin', 'Seventh Circuit', '517 East Wisconsin Avenue', 'Milwaukee', 'WI', '53202', 43.0389, -87.9065, 'Main district courthouse'),
  ('Robert W. Kastenmeier United States Courthouse', 'Western District of Wisconsin - Madison', 'district_court', 'Western District of Wisconsin', 'Seventh Circuit', '120 North Henry Street', 'Madison', 'WI', '53703', 43.0731, -89.4012, 'Main district courthouse'),

  -- EIGHTH CIRCUIT
  ('Thomas F. Eagleton United States Courthouse', 'Eighth Circuit - St. Louis', 'circuit_court_of_appeals', 'Eighth Circuit', 'Eighth Circuit', '111 South 10th Street', 'St. Louis', 'MO', '63102', 38.6270, -90.1994, 'Seat of the Eighth Circuit Court of Appeals'),
  ('Thomas F. Eagleton United States Courthouse', 'Eastern District of Missouri - St. Louis', 'district_court', 'Eastern District of Missouri', 'Eighth Circuit', '111 South 10th Street', 'St. Louis', 'MO', '63102', 38.6270, -90.1994, 'Main district courthouse'),
  ('Charles Evans Whittaker United States Courthouse', 'Western District of Missouri - Kansas City', 'district_court', 'Western District of Missouri', 'Eighth Circuit', '400 East 9th Street', 'Kansas City', 'MO', '64106', 39.0997, -94.5786, 'Main district courthouse'),
  ('Diana E. Murphy United States Courthouse', 'District of Minnesota - Minneapolis', 'district_court', 'District of Minnesota', 'Eighth Circuit', '300 South Fourth Street', 'Minneapolis', 'MN', '55415', 44.9778, -93.2650, 'Main district courthouse'),
  ('Warren E. Burger Federal Building and United States Courthouse', 'District of Minnesota - St. Paul', 'district_court', 'District of Minnesota', 'Eighth Circuit', '316 North Robert Street', 'St. Paul', 'MN', '55101', 44.9537, -93.0900, 'Divisional courthouse'),
  ('Isaac C. Parker Federal Building', 'Western District of Arkansas - Fort Smith', 'district_court', 'Western District of Arkansas', 'Eighth Circuit', '30 South 6th Street', 'Fort Smith', 'AR', '72901', 35.3859, -94.4244, 'Main district courthouse'),
  ('Richard Sheppard Arnold United States Courthouse', 'Eastern District of Arkansas - Little Rock', 'district_court', 'Eastern District of Arkansas', 'Eighth Circuit', '600 West Capitol Avenue', 'Little Rock', 'AR', '72201', 34.7465, -92.2896, 'Main district courthouse'),
  ('United States Courthouse', 'Southern District of Iowa - Des Moines', 'district_court', 'Southern District of Iowa', 'Eighth Circuit', '123 East Walnut Street', 'Des Moines', 'IA', '50309', 41.5868, -93.6250, 'Main district courthouse'),
  ('Cedar Rapids Federal Courthouse', 'Northern District of Iowa - Cedar Rapids', 'district_court', 'Northern District of Iowa', 'Eighth Circuit', '111 Seventh Avenue SE', 'Cedar Rapids', 'IA', '52401', 41.9779, -91.6656, 'Main district courthouse'),
  ('Roman L. Hruska United States Courthouse', 'District of Nebraska - Omaha', 'district_court', 'District of Nebraska', 'Eighth Circuit', '111 South 18th Plaza', 'Omaha', 'NE', '68102', 41.2565, -95.9345, 'Main district courthouse'),
  ('Robert V. Denney Federal Building and United States Courthouse', 'District of Nebraska - Lincoln', 'district_court', 'District of Nebraska', 'Eighth Circuit', '100 Centennial Mall North', 'Lincoln', 'NE', '68508', 40.8136, -96.7026, 'Divisional courthouse'),
  ('Quentin N. Burdick United States Courthouse', 'District of North Dakota - Fargo', 'district_court', 'District of North Dakota', 'Eighth Circuit', '655 First Avenue North', 'Fargo', 'ND', '58102', 46.8772, -96.7894, 'Main district courthouse'),
  ('Andrew W. Bogue Federal Building and United States Courthouse', 'District of South Dakota - Rapid City', 'district_court', 'District of South Dakota', 'Eighth Circuit', '515 Ninth Street', 'Rapid City', 'SD', '57701', 44.0805, -103.2310, 'Main district courthouse'),

  -- NINTH CIRCUIT
  ('James R. Browning United States Court of Appeals Building', 'Ninth Circuit - San Francisco', 'circuit_court_of_appeals', 'Ninth Circuit', 'Ninth Circuit', '95 Seventh Street', 'San Francisco', 'CA', '94103', 37.7794, -122.4110, 'Seat of the Ninth Circuit Court of Appeals'),
  ('Phillip Burton Federal Building and United States Courthouse', 'Northern District of California - San Francisco', 'district_court', 'Northern District of California', 'Ninth Circuit', '450 Golden Gate Avenue', 'San Francisco', 'CA', '94102', 37.7820, -122.4170, 'Main district courthouse'),
  ('United States Courthouse', 'Northern District of California - San Jose', 'district_court', 'Northern District of California', 'Ninth Circuit', '280 South First Street', 'San Jose', 'CA', '95113', 37.3330, -121.8900, 'Divisional courthouse'),
  ('United States Courthouse', 'Central District of California - Los Angeles', 'district_court', 'Central District of California', 'Ninth Circuit', '350 West 1st Street', 'Los Angeles', 'CA', '90012', 34.0522, -118.2437, 'Main district courthouse for CDCA'),
  ('Ronald Reagan Federal Building and United States Courthouse', 'Central District of California - Santa Ana', 'district_court', 'Central District of California', 'Ninth Circuit', '411 West Fourth Street', 'Santa Ana', 'CA', '92701', 33.7455, -117.8677, 'Divisional courthouse'),
  ('James M. Carter and Judith N. Keep United States Courthouse', 'Southern District of California - San Diego', 'district_court', 'Southern District of California', 'Ninth Circuit', '333 West Broadway', 'San Diego', 'CA', '92101', 32.7157, -117.1611, 'Main district courthouse'),
  ('Robert E. Coyle United States Courthouse', 'Eastern District of California - Fresno', 'district_court', 'Eastern District of California', 'Ninth Circuit', '2500 Tulare Street', 'Fresno', 'CA', '93721', 36.7378, -119.7871, 'Main district courthouse'),
  ('United States Courthouse', 'Eastern District of California - Sacramento', 'district_court', 'Eastern District of California', 'Ninth Circuit', '501 I Street', 'Sacramento', 'CA', '95814', 38.5816, -121.4944, 'Divisional courthouse'),
  ('Sandra Day O''Connor United States Courthouse', 'District of Arizona - Phoenix', 'district_court', 'District of Arizona', 'Ninth Circuit', '401 West Washington Street', 'Phoenix', 'AZ', '85003', 33.4484, -112.0740, 'Main district courthouse'),
  ('James A. Walsh United States Courthouse', 'District of Arizona - Tucson', 'district_court', 'District of Arizona', 'Ninth Circuit', '405 West Congress Street', 'Tucson', 'AZ', '85701', 32.2217, -110.9265, 'Divisional courthouse'),
  ('United States Courthouse', 'District of Oregon - Portland', 'district_court', 'District of Oregon', 'Ninth Circuit', '1000 SW Third Avenue', 'Portland', 'OR', '97204', 45.5231, -122.6765, 'Main district courthouse'),
  ('William Wayne Justice Government Center', 'Eastern District of Washington - Spokane', 'district_court', 'Eastern District of Washington', 'Ninth Circuit', '920 West Riverside Avenue', 'Spokane', 'WA', '99201', 47.6588, -117.4260, 'Main district courthouse'),
  ('United States Courthouse', 'Western District of Washington - Seattle', 'district_court', 'Western District of Washington', 'Ninth Circuit', '700 Stewart Street', 'Seattle', 'WA', '98101', 47.6062, -122.3321, 'Main district courthouse'),
  ('James M. Fitzgerald United States Courthouse', 'District of Alaska - Anchorage', 'district_court', 'District of Alaska', 'Ninth Circuit', '222 West 7th Avenue', 'Anchorage', 'AK', '99513', 61.2181, -149.9003, 'Main district courthouse'),
  ('United States Courthouse', 'District of Hawaii - Honolulu', 'district_court', 'District of Hawaii', 'Ninth Circuit', '300 Ala Moana Boulevard', 'Honolulu', 'HI', '96850', 21.3069, -157.8583, 'Main district courthouse'),
  ('James A. McClure Federal Building and United States Courthouse', 'District of Idaho - Boise', 'district_court', 'District of Idaho', 'Ninth Circuit', '550 West Fort Street', 'Boise', 'ID', '83724', 43.6150, -116.2023, 'Main district courthouse'),
  ('Lloyd D. George United States Courthouse', 'District of Nevada - Las Vegas', 'district_court', 'District of Nevada', 'Ninth Circuit', '333 Las Vegas Boulevard South', 'Las Vegas', 'NV', '89101', 36.1716, -115.1391, 'Main district courthouse'),
  ('Bruce R. Thompson United States Courthouse and Federal Building', 'District of Nevada - Reno', 'district_court', 'District of Nevada', 'Ninth Circuit', '400 South Virginia Street', 'Reno', 'NV', '89501', 39.5296, -119.8138, 'Divisional courthouse'),
  ('Russell E. Smith Federal Building', 'District of Montana - Missoula', 'district_court', 'District of Montana', 'Ninth Circuit', '201 East Broadway', 'Missoula', 'MT', '59802', 46.8721, -113.9940, 'Main district courthouse'),
  ('District Court of Guam', 'District of Guam - Hagatna', 'district_court', 'District of Guam', 'Ninth Circuit', '520 West Soledad Avenue', 'Hagatna', 'GU', '96910', 13.4742, 144.7506, 'Main district courthouse'),
  ('United States District Court for the Northern Mariana Islands', 'District of the Northern Mariana Islands - Saipan', 'district_court', 'District of the Northern Mariana Islands', 'Ninth Circuit', 'Beach Road, Gualo Rai', 'Saipan', 'MP', '96950', 15.2000, 145.7500, 'Main district courthouse'),

  -- TENTH CIRCUIT
  ('Byron White United States Courthouse', 'Tenth Circuit - Denver', 'circuit_court_of_appeals', 'Tenth Circuit', 'Tenth Circuit', '1823 Stout Street', 'Denver', 'CO', '80257', 39.7485, -104.9930, 'Seat of the Tenth Circuit Court of Appeals'),
  ('Alfred A. Arraj United States Courthouse', 'District of Colorado - Denver', 'district_court', 'District of Colorado', 'Tenth Circuit', '901 19th Street', 'Denver', 'CO', '80294', 39.7490, -104.9910, 'Main district courthouse'),
  ('Robert J. Dole United States Courthouse', 'District of Kansas - Kansas City', 'district_court', 'District of Kansas', 'Tenth Circuit', '500 State Avenue', 'Kansas City', 'KS', '66101', 39.1141, -94.6272, 'Main district courthouse'),
  ('Frank Carlson Federal Building and United States Courthouse', 'District of Kansas - Topeka', 'district_court', 'District of Kansas', 'Tenth Circuit', '444 SE Quincy Street', 'Topeka', 'KS', '66683', 39.0473, -95.6752, 'Divisional courthouse'),
  ('Pete V. Domenici United States Courthouse', 'District of New Mexico - Albuquerque', 'district_court', 'District of New Mexico', 'Tenth Circuit', '333 Lomas Boulevard NW', 'Albuquerque', 'NM', '87102', 35.0844, -106.6504, 'Main district courthouse'),
  ('William J. Holloway Jr. United States Courthouse', 'Western District of Oklahoma - Oklahoma City', 'district_court', 'Western District of Oklahoma', 'Tenth Circuit', '200 NW 4th Street', 'Oklahoma City', 'OK', '73102', 35.4676, -97.5164, 'Main district courthouse'),
  ('Page Belcher Federal Building and United States Courthouse', 'Northern District of Oklahoma - Tulsa', 'district_court', 'Northern District of Oklahoma', 'Tenth Circuit', '333 West 4th Street', 'Tulsa', 'OK', '74103', 36.1540, -95.9928, 'Main district courthouse'),
  ('Orrin G. Hatch United States Courthouse', 'District of Utah - Salt Lake City', 'district_court', 'District of Utah', 'Tenth Circuit', '351 South West Temple', 'Salt Lake City', 'UT', '84101', 40.7608, -111.8910, 'Main district courthouse'),
  ('Ewing T. Kerr Federal Building and United States Courthouse', 'District of Wyoming - Casper', 'district_court', 'District of Wyoming', 'Tenth Circuit', '111 South Wolcott Street', 'Casper', 'WY', '82601', 42.8501, -106.3251, 'Main district courthouse'),

  -- ELEVENTH CIRCUIT
  ('Elbert P. Tuttle United States Court of Appeals Building', 'Eleventh Circuit - Atlanta', 'circuit_court_of_appeals', 'Eleventh Circuit', 'Eleventh Circuit', '56 Forsyth Street NW', 'Atlanta', 'GA', '30303', 33.7550, -84.3900, 'Seat of the Eleventh Circuit Court of Appeals'),
  ('Richard B. Russell Federal Building and United States Courthouse', 'Northern District of Georgia - Atlanta', 'district_court', 'Northern District of Georgia', 'Eleventh Circuit', '75 Ted Turner Drive SW', 'Atlanta', 'GA', '30303', 33.7530, -84.3930, 'Main district courthouse'),
  ('Wilkie D. Ferguson Jr. United States Courthouse', 'Southern District of Florida - Miami', 'district_court', 'Southern District of Florida', 'Eleventh Circuit', '400 North Miami Avenue', 'Miami', 'FL', '33128', 25.7743, -80.1937, 'Main district courthouse'),
  ('Paul G. Rogers Federal Building and United States Courthouse', 'Southern District of Florida - West Palm Beach', 'district_court', 'Southern District of Florida', 'Eleventh Circuit', '701 Clematis Street', 'West Palm Beach', 'FL', '33401', 26.7153, -80.0533, 'Divisional courthouse'),
  ('Bryan Simpson United States Courthouse', 'Middle District of Florida - Jacksonville', 'district_court', 'Middle District of Florida', 'Eleventh Circuit', '300 North Hogan Street', 'Jacksonville', 'FL', '32202', 30.3322, -81.6557, 'Main district courthouse'),
  ('United States Courthouse', 'Middle District of Florida - Tampa', 'district_court', 'Middle District of Florida', 'Eleventh Circuit', '801 North Florida Avenue', 'Tampa', 'FL', '33602', 27.9506, -82.4572, 'Divisional courthouse'),
  ('United States Courthouse', 'Northern District of Florida - Tallahassee', 'district_court', 'Northern District of Florida', 'Eleventh Circuit', '111 North Adams Street', 'Tallahassee', 'FL', '32301', 30.4383, -84.2807, 'Main district courthouse'),
  ('Frank M. Johnson Jr. Federal Building and United States Courthouse', 'Middle District of Alabama - Montgomery', 'district_court', 'Middle District of Alabama', 'Eleventh Circuit', '151 Eastern Boulevard', 'Montgomery', 'AL', '36117', 32.3668, -86.2999, 'Main district courthouse'),
  ('Hugo L. Black United States Courthouse', 'Northern District of Alabama - Birmingham', 'district_court', 'Northern District of Alabama', 'Eleventh Circuit', '1729 5th Avenue North', 'Birmingham', 'AL', '35203', 33.5186, -86.8104, 'Main district courthouse'),

  -- DC CIRCUIT
  ('E. Barrett Prettyman United States Courthouse', 'DC Circuit - Washington', 'circuit_court_of_appeals', 'DC Circuit', 'DC Circuit', '333 Constitution Avenue NW', 'Washington', 'DC', '20001', 38.8922, -77.0161, 'Seat of the DC Circuit Court of Appeals'),
  ('E. Barrett Prettyman United States Courthouse', 'District of Columbia - Washington', 'district_court', 'District of Columbia', 'DC Circuit', '333 Constitution Avenue NW', 'Washington', 'DC', '20001', 38.8922, -77.0161, 'Main district courthouse for District of Columbia'),

  -- FEDERAL CIRCUIT & SPECIALTY COURTS
  ('Howard T. Markey National Courts Building', 'Federal Circuit - Washington', 'circuit_court_of_appeals', 'Federal Circuit', 'Federal Circuit', '717 Madison Place NW', 'Washington', 'DC', '20439', 38.8994, -77.0339, 'Seat of the US Court of Appeals for the Federal Circuit'),
  ('Howard T. Markey National Courts Building', 'US Court of Federal Claims - Washington', 'specialty_court', 'National', 'Federal Circuit', '717 Madison Place NW', 'Washington', 'DC', '20005', 38.8994, -77.0339, 'US Court of Federal Claims'),
  ('United States Tax Court Building', 'US Tax Court - Washington', 'specialty_court', 'National', 'None', '400 Second Street NW', 'Washington', 'DC', '20217', 38.8944, -77.0144, 'United States Tax Court'),
  ('James L. Watson United States Court of International Trade Building', 'US Court of International Trade - New York', 'specialty_court', 'National', 'Federal Circuit', 'One Federal Plaza', 'New York', 'NY', '10278', 40.7144, -74.0022, 'US Court of International Trade'),
  ('United States Court of Appeals for Veterans Claims', 'US Court of Appeals for Veterans Claims - Washington', 'specialty_court', 'National', 'None', '625 Indiana Avenue NW', 'Washington', 'DC', '20004', 38.8941, -77.0211, 'US Court of Appeals for Veterans Claims'),
  ('United States Court of Appeals for the Armed Forces', 'United States Court of Appeals for the Armed Forces - Washington', 'specialty_court', 'National', 'None', '450 E Street NW', 'Washington', 'DC', '20442', 38.8950, -77.0180, 'US Court of Appeals for the Armed Forces'),

  -- ADDITIONAL DISTRICT COURTS & DIVISIONAL LOCATIONS
  -- Alabama (Southern)
  ('John Archibald Campbell United States Courthouse', 'Southern District of Alabama - Mobile', 'district_court', 'Southern District of Alabama', 'Eleventh Circuit', '113 St. Joseph Street', 'Mobile', 'AL', '36602', 30.6922, -88.0431, 'Main district courthouse'),
  -- Alaska
  ('United States Post Office and Courthouse', 'District of Alaska - Fairbanks', 'district_court', 'District of Alaska', 'Ninth Circuit', '101 12th Avenue', 'Fairbanks', 'AK', '99701', 64.8431, -147.7231, 'Divisional courthouse'),
  ('United States Post Office and Courthouse', 'District of Alaska - Juneau', 'district_court', 'District of Alaska', 'Ninth Circuit', '709 West 9th Street', 'Juneau', 'AK', '99801', 58.3019, -134.4197, 'Divisional courthouse'),
  -- Arizona
  ('United States Courthouse', 'District of Arizona - Flagstaff', 'district_court', 'District of Arizona', 'Ninth Circuit', '123 North San Francisco Street', 'Flagstaff', 'AZ', '86001', 35.1981, -111.6514, 'Divisional courthouse'),
  -- Arkansas (Eastern)
  ('George Howard Jr. Federal Building and United States Courthouse', 'Eastern District of Arkansas - Pine Bluff', 'district_court', 'Eastern District of Arkansas', 'Eighth Circuit', '100 East 8th Avenue', 'Pine Bluff', 'AR', '71601', 34.2284, -92.0031, 'Divisional courthouse'),
  -- California (Eastern)
  ('United States Courthouse', 'Eastern District of California - Redding', 'district_court', 'Eastern District of California', 'Ninth Circuit', '2986 Bechelli Lane', 'Redding', 'CA', '96002', 40.5865, -122.3917, 'Divisional courthouse'),
  ('United States Courthouse', 'Eastern District of California - Bakersfield', 'district_court', 'Eastern District of California', 'Ninth Circuit', '510 19th Street', 'Bakersfield', 'CA', '93301', 35.3733, -119.0187, 'Divisional courthouse'),
  -- California (Central)
  ('Edward R. Roybal Federal Building and United States Courthouse', 'Central District of California - Los Angeles (Roybal)', 'district_court', 'Central District of California', 'Ninth Circuit', '255 East Temple Street', 'Los Angeles', 'CA', '90012', 34.0500, -118.2400, 'CDCA secondary location'),
  ('George E. Brown Jr. Federal Building and United States Courthouse', 'Central District of California - Riverside', 'district_court', 'Central District of California', 'Ninth Circuit', '3470 Twelfth Street', 'Riverside', 'CA', '92501', 33.9806, -117.3755, 'Divisional courthouse'),
  -- California (Southern)
  ('United States Courthouse', 'Southern District of California - El Centro', 'district_court', 'Southern District of California', 'Ninth Circuit', '2001 West Adams Avenue', 'El Centro', 'CA', '92243', 32.7920, -115.5631, 'Divisional courthouse'),
  -- Colorado
  ('Wayne Aspinall Federal Building and United States Courthouse', 'District of Colorado - Grand Junction', 'district_court', 'District of Colorado', 'Tenth Circuit', '400 Rood Avenue', 'Grand Junction', 'CO', '81501', 39.0639, -108.5667, 'Divisional courthouse'),
  -- Florida (Northern)
  ('United States Courthouse', 'Northern District of Florida - Pensacola', 'district_court', 'Northern District of Florida', 'Eleventh Circuit', '1 North Palafox Street', 'Pensacola', 'FL', '32502', 30.4131, -87.2150, 'Divisional courthouse'),
  ('United States Courthouse', 'Northern District of Florida - Gainesville', 'district_court', 'Northern District of Florida', 'Eleventh Circuit', '401 SE 1st Avenue', 'Gainesville', 'FL', '32601', 29.6516, -82.3248, 'Divisional courthouse'),
  ('United States Courthouse', 'Northern District of Florida - Panama City', 'district_court', 'Northern District of Florida', 'Eleventh Circuit', '30 West Government Street', 'Panama City', 'FL', '32401', 30.1588, -85.6603, 'Divisional courthouse'),
  -- Florida (Middle)
  ('United States Courthouse', 'Middle District of Florida - Orlando', 'district_court', 'Middle District of Florida', 'Eleventh Circuit', '401 West Central Boulevard', 'Orlando', 'FL', '32801', 28.5419, -81.3831, 'Divisional courthouse'),
  ('United States Courthouse', 'Middle District of Florida - Fort Myers', 'district_court', 'Middle District of Florida', 'Eleventh Circuit', '2110 First Street', 'Fort Myers', 'FL', '33901', 26.6406, -81.8722, 'Divisional courthouse'),
  ('United States Courthouse', 'Middle District of Florida - Ocala', 'district_court', 'Middle District of Florida', 'Eleventh Circuit', '207 NW Second Street', 'Ocala', 'FL', '34475', 29.1872, -82.1375, 'Divisional courthouse'),
  -- Florida (Southern)
  ('United States Courthouse', 'Southern District of Florida - Fort Lauderdale', 'district_court', 'Southern District of Florida', 'Eleventh Circuit', '299 East Broward Boulevard', 'Fort Lauderdale', 'FL', '33301', 26.1224, -80.1373, 'Divisional courthouse'),
  ('United States Courthouse', 'Southern District of Florida - Fort Pierce', 'district_court', 'Southern District of Florida', 'Eleventh Circuit', '101 South U.S. Highway 1', 'Fort Pierce', 'FL', '34950', 27.4467, -80.3256, 'Divisional courthouse'),
  ('United States Courthouse', 'Southern District of Florida - Key West', 'district_court', 'Southern District of Florida', 'Eleventh Circuit', '301 Simonton Street', 'Key West', 'FL', '33040', 24.5551, -81.8044, 'Divisional courthouse'),
  -- Georgia (Northern)
  ('United States Courthouse', 'Northern District of Georgia - Gainesville', 'district_court', 'Northern District of Georgia', 'Eleventh Circuit', '121 Spring Street SE', 'Gainesville', 'GA', '30501', 34.2978, -83.8242, 'Divisional courthouse'),
  ('United States Courthouse', 'Northern District of Georgia - Newnan', 'district_court', 'Northern District of Georgia', 'Eleventh Circuit', '18 Greenville Street', 'Newnan', 'GA', '30263', 33.3739, -84.7997, 'Divisional courthouse'),
  ('United States Courthouse', 'Northern District of Georgia - Rome', 'district_court', 'Northern District of Georgia', 'Eleventh Circuit', '600 East First Street', 'Rome', 'GA', '30161', 34.2570, -85.1647, 'Divisional courthouse'),
  -- Georgia (Middle)
  ('William Augustus Bootle Federal Building and United States Courthouse', 'Middle District of Georgia - Macon', 'district_court', 'Middle District of Georgia', 'Eleventh Circuit', '475 Mulberry Street', 'Macon', 'GA', '31201', 32.8406, -83.6324, 'Main district courthouse'),
  ('C.B. King United States Courthouse', 'Middle District of Georgia - Albany', 'district_court', 'Middle District of Georgia', 'Eleventh Circuit', '201 West Broad Avenue', 'Albany', 'GA', '31701', 31.5785, -84.1558, 'Divisional courthouse'),
  ('United States Courthouse', 'Middle District of Georgia - Columbus', 'district_court', 'Middle District of Georgia', 'Eleventh Circuit', '120 12th Street', 'Columbus', 'GA', '31901', 32.4610, -84.9877, 'Divisional courthouse'),
  ('United States Courthouse', 'Middle District of Georgia - Valdosta', 'district_court', 'Middle District of Georgia', 'Eleventh Circuit', '401 North Patterson Street', 'Valdosta', 'GA', '31601', 30.8327, -83.2784, 'Divisional courthouse'),
  -- Georgia (Southern)
  ('Tomochichi Federal Building and United States Courthouse', 'Southern District of Georgia - Savannah', 'district_court', 'Southern District of Georgia', 'Eleventh Circuit', '125 Bull Street', 'Savannah', 'GA', '31401', 32.0761, -81.0912, 'Main district courthouse'),
  ('United States Courthouse', 'Southern District of Georgia - Augusta', 'district_court', 'Southern District of Georgia', 'Eleventh Circuit', '600 James Brown Boulevard', 'Augusta', 'GA', '30901', 33.4703, -81.9748, 'Divisional courthouse'),
  ('United States Courthouse', 'Southern District of Georgia - Brunswick', 'district_court', 'Southern District of Georgia', 'Eleventh Circuit', '801 Gloucester Street', 'Brunswick', 'GA', '31520', 31.1472, -81.4912, 'Divisional courthouse'),
  -- Hawaii
  ('United States Courthouse', 'District of Hawaii - Wailuku', 'district_court', 'District of Hawaii', 'Ninth Circuit', '2145 Wells Street', 'Wailuku', 'HI', '96793', 20.8911, -156.5047, 'Divisional courthouse'),
  -- Idaho
  ('United States Courthouse', 'District of Idaho - Coeur d''Alene', 'district_court', 'District of Idaho', 'Ninth Circuit', '6450 North Mineral Drive', 'Coeur d''Alene', 'ID', '83815', 47.7231, -116.7831, 'Divisional courthouse'),
  ('United States Courthouse', 'District of Idaho - Pocatello', 'district_court', 'District of Idaho', 'Ninth Circuit', '801 East Sherman Street', 'Pocatello', 'ID', '83201', 42.8712, -112.4450, 'Divisional courthouse'),
  -- Illinois (Northern)
  ('Everett McKinley Dirksen United States Courthouse', 'District of Illinois (Bankruptcy) - Chicago', 'bankruptcy_court', 'Northern District of Illinois', 'Seventh Circuit', '219 South Dearborn Street', 'Chicago', 'IL', '60604', 41.8781, -87.6298, 'Bankruptcy division'),
  -- Illinois (Central)
  ('United States Courthouse', 'Central District of Illinois - Peoria', 'district_court', 'Central District of Illinois', 'Seventh Circuit', '100 NE Monroe Street', 'Peoria', 'IL', '61602', 40.6936, -89.5889, 'Divisional courthouse'),
  ('United States Courthouse', 'Central District of Illinois - Urbana', 'district_court', 'Central District of Illinois', 'Seventh Circuit', '201 South Vine Street', 'Urbana', 'IL', '61802', 40.1106, -88.2072, 'Divisional courthouse'),
  -- Illinois (Southern)
  ('United States Courthouse', 'Southern District of Illinois - Benton', 'district_court', 'Southern District of Illinois', 'Seventh Circuit', '301 West Main Street', 'Benton', 'IL', '62812', 37.9967, -88.9206, 'Divisional courthouse'),
  -- Indiana (Northern)
  ('United States Courthouse', 'Northern District of Indiana - Hammond', 'district_court', 'Northern District of Indiana', 'Seventh Circuit', '5400 Federal Plaza', 'Hammond', 'IN', '46320', 41.6214, -87.5120, 'Divisional courthouse'),
  ('United States Courthouse', 'Northern District of Indiana - Lafayette', 'district_court', 'Northern District of Indiana', 'Seventh Circuit', '230 North Fourth Street', 'Lafayette', 'IN', '47901', 40.4191, -86.8917, 'Divisional courthouse'),
  -- Indiana (Southern)
  ('United States Courthouse', 'Southern District of Indiana - Evansville', 'district_court', 'Southern District of Indiana', 'Seventh Circuit', '101 NW Martin Luther King Jr. Boulevard', 'Evansville', 'IN', '47708', 37.9716, -87.5711, 'Divisional courthouse'),
  ('United States Courthouse', 'Southern District of Indiana - New Albany', 'district_court', 'Southern District of Indiana', 'Seventh Circuit', '121 West Spring Street', 'New Albany', 'IN', '47150', 38.2856, -85.8242, 'Divisional courthouse'),
  ('United States Courthouse', 'Southern District of Indiana - Terre Haute', 'district_court', 'Southern District of Indiana', 'Seventh Circuit', '921 Ohio Street', 'Terre Haute', 'IN', '47807', 39.4667, -87.4139, 'Divisional courthouse'),
  -- Iowa (Northern)
  ('United States Courthouse', 'Northern District of Iowa - Sioux City', 'district_court', 'Northern District of Iowa', 'Eighth Circuit', '320 Sixth Street', 'Sioux City', 'IA', '51101', 42.4999, -96.4003, 'Divisional courthouse'),
  -- Iowa (Southern)
  ('United States Courthouse', 'Southern District of Iowa - Council Bluffs', 'district_court', 'Southern District of Iowa', 'Eighth Circuit', '8 South Sixth Street', 'Council Bluffs', 'IA', '51501', 41.2619, -95.8508, 'Divisional courthouse'),
  ('United States Courthouse', 'Southern District of Iowa - Davenport', 'district_court', 'Southern District of Iowa', 'Eighth Circuit', '131 East Fourth Street', 'Davenport', 'IA', '52801', 41.5236, -90.5775, 'Divisional courthouse'),
  -- Kansas
  ('United States Courthouse', 'District of Kansas - Wichita', 'district_court', 'District of Kansas', 'Tenth Circuit', '401 North Market Street', 'Wichita', 'KS', '67202', 37.6889, -97.3361, 'Divisional courthouse'),
  -- Kentucky (Eastern)
  ('United States Courthouse', 'Eastern District of Kentucky - Covington', 'district_court', 'Eastern District of Kentucky', 'Sixth Circuit', '35 West 5th Street', 'Covington', 'KY', '41011', 39.0837, -84.5122, 'Divisional courthouse'),
  ('United States Courthouse', 'Eastern District of Kentucky - Frankfort', 'district_court', 'Eastern District of Kentucky', 'Sixth Circuit', '130 West Broadway', 'Frankfort', 'KY', '40601', 38.1972, -84.8631, 'Divisional courthouse'),
  ('United States Courthouse', 'Eastern District of Kentucky - London', 'district_court', 'Eastern District of Kentucky', 'Sixth Circuit', '310 West Main Street', 'London', 'KY', '40741', 37.1289, -84.0833, 'Divisional courthouse'),
  ('United States Courthouse', 'Eastern District of Kentucky - Ashland', 'district_court', 'Eastern District of Kentucky', 'Sixth Circuit', '1405 Greenup Avenue', 'Ashland', 'KY', '41101', 38.4783, -82.6372, 'Divisional courthouse'),
  ('United States Courthouse', 'Eastern District of Kentucky - Pikeville', 'district_court', 'Eastern District of Kentucky', 'Sixth Circuit', '110 Main Street', 'Pikeville', 'KY', '41501', 37.4792, -82.5189, 'Divisional courthouse'),
  -- Kentucky (Western)
  ('United States Courthouse', 'Western District of Kentucky - Bowling Green', 'district_court', 'Western District of Kentucky', 'Sixth Circuit', '241 East Main Avenue', 'Bowling Green', 'KY', '42101', 36.9903, -86.4436, 'Divisional courthouse'),
  ('United States Courthouse', 'Western District of Kentucky - Owensboro', 'district_court', 'Western District of Kentucky', 'Sixth Circuit', '423 Frederica Street', 'Owensboro', 'KY', '42301', 37.7719, -87.1111, 'Divisional courthouse'),
  ('United States Courthouse', 'Western District of Kentucky - Paducah', 'district_court', 'Western District of Kentucky', 'Sixth Circuit', '501 Broadway', 'Paducah', 'KY', '42001', 37.0834, -88.6000, 'Divisional courthouse'),
  -- Louisiana (Eastern)
  ('United States Courthouse', 'Eastern District of Louisiana - Houma', 'magistrate_court', 'Eastern District of Louisiana', 'Fifth Circuit', '7272 Main Street', 'Houma', 'LA', '70360', 29.5958, -90.7194, 'Divisional location'),
  -- Louisiana (Western)
  ('United States Courthouse', 'Western District of Louisiana - Alexandria', 'district_court', 'Western District of Louisiana', 'Fifth Circuit', '515 Murray Street', 'Alexandria', 'LA', '71301', 31.3113, -92.4450, 'Divisional courthouse'),
  ('United States Courthouse', 'Western District of Louisiana - Lafayette', 'district_court', 'Western District of Louisiana', 'Fifth Circuit', '800 Lafayette Street', 'Lafayette', 'LA', '70501', 30.2241, -92.0197, 'Divisional courthouse'),
  ('United States Courthouse', 'Western District of Louisiana - Lake Charles', 'district_court', 'Western District of Louisiana', 'Fifth Circuit', '611 Broad Street', 'Lake Charles', 'LA', '70601', 30.2266, -93.2175, 'Divisional courthouse'),
  ('United States Courthouse', 'Western District of Louisiana - Monroe', 'district_court', 'Western District of Louisiana', 'Fifth Circuit', '201 Jackson Street', 'Monroe', 'LA', '71201', 32.5007, -92.1194, 'Divisional courthouse'),
  -- Maryland
  ('United States Courthouse', 'District of Maryland - Salisbury', 'magistrate_court', 'District of Maryland', 'Fourth Circuit', '129 East Main Street', 'Salisbury', 'MD', '21801', 38.3607, -75.5994, 'Divisional location'),
  -- Massachusetts
  ('United States Courthouse', 'District of Massachusetts - Hyannis', 'magistrate_court', 'District of Massachusetts', 'First Circuit', '1200 Phinney''s Lane', 'Hyannis', 'MA', '02601', 41.6528, -70.2822, 'Divisional location'),
  -- Michigan (Eastern)
  ('United States Courthouse', 'Eastern District of Michigan - Ann Arbor', 'district_court', 'Eastern District of Michigan', 'Sixth Circuit', '200 East Liberty Street', 'Ann Arbor', 'MI', '48104', 42.2808, -83.7431, 'Divisional courthouse'),
  ('United States Courthouse', 'Eastern District of Michigan - Bay City', 'district_court', 'Eastern District of Michigan', 'Sixth Circuit', '1000 Washington Avenue', 'Bay City', 'MI', '48708', 43.5944, -83.8889, 'Divisional courthouse'),
  ('United States Courthouse', 'Eastern District of Michigan - Flint', 'district_court', 'Eastern District of Michigan', 'Sixth Circuit', '600 Church Street', 'Flint', 'MI', '48502', 43.0125, -83.6931, 'Divisional courthouse'),
  ('United States Courthouse', 'Eastern District of Michigan - Port Huron', 'district_court', 'Eastern District of Michigan', 'Sixth Circuit', '526 Water Street', 'Port Huron', 'MI', '48060', 42.9708, -82.4239, 'Divisional courthouse'),
  -- Michigan (Western)
  ('United States Courthouse', 'Western District of Michigan - Kalamazoo', 'district_court', 'Western District of Michigan', 'Sixth Circuit', '410 West Michigan Avenue', 'Kalamazoo', 'MI', '49007', 42.2917, -85.5872, 'Divisional courthouse'),
  ('United States Courthouse', 'Western District of Michigan - Lansing', 'district_court', 'Western District of Michigan', 'Sixth Circuit', '315 West Allegan Street', 'Lansing', 'MI', '48933', 42.7325, -84.5556, 'Divisional courthouse'),
  ('United States Courthouse', 'Western District of Michigan - Marquette', 'district_court', 'Western District of Michigan', 'Sixth Circuit', '202 West Washington Street', 'Marquette', 'MI', '49855', 46.5436, -87.3953, 'Divisional courthouse'),
  -- Minnesota
  ('United States Courthouse', 'District of Minnesota - Duluth', 'district_court', 'District of Minnesota', 'Eighth Circuit', '515 West First Street', 'Duluth', 'MN', '55802', 46.7867, -92.1005, 'Divisional courthouse'),
  ('United States Courthouse', 'District of Minnesota - Fergus Falls', 'district_court', 'District of Minnesota', 'Eighth Circuit', '118 South Mill Street', 'Fergus Falls', 'MN', '56537', 46.2831, -96.0778, 'Divisional courthouse'),
  -- Mississippi (Northern)
  ('United States Courthouse', 'Northern District of Mississippi - Aberdeen', 'district_court', 'Northern District of Mississippi', 'Fifth Circuit', '201 West Commerce Street', 'Aberdeen', 'MS', '39730', 33.8251, -88.5436, 'Divisional courthouse'),
  ('United States Courthouse', 'Northern District of Mississippi - Greenville', 'district_court', 'Northern District of Mississippi', 'Fifth Circuit', '305 Main Street', 'Greenville', 'MS', '38701', 33.4101, -91.0617, 'Divisional courthouse'),
  -- Mississippi (Southern)
  ('United States Courthouse', 'Southern District of Mississippi - Gulfport', 'district_court', 'Southern District of Mississippi', 'Fifth Circuit', '2012 15th Street', 'Gulfport', 'MS', '39501', 30.3675, -89.0928, 'Divisional courthouse'),
  -- Missouri (Eastern)
  ('United States Courthouse', 'Eastern District of Missouri - Cape Girardeau', 'district_court', 'Eastern District of Missouri', 'Eighth Circuit', '555 Independence Street', 'Cape Girardeau', 'MO', '63703', 37.3008, -89.5186, 'Divisional courthouse'),
  -- Missouri (Western)
  ('United States Courthouse', 'Western District of Missouri - Springfield', 'district_court', 'Western District of Missouri', 'Eighth Circuit', '222 North John Q. Hammons Parkway', 'Springfield', 'MO', '65806', 37.2089, -93.2922, 'Divisional courthouse'),
  ('United States Courthouse', 'Western District of Missouri - Jefferson City', 'district_court', 'Western District of Missouri', 'Eighth Circuit', '80 Lafayette Street', 'Jefferson City', 'MO', '65101', 38.5767, -92.1736, 'Divisional courthouse'),
  ('United States Courthouse', 'Western District of Missouri - Joplin', 'district_court', 'Western District of Missouri', 'Eighth Circuit', '400 South Main Street', 'Joplin', 'MO', '64801', 37.0842, -94.5133, 'Divisional courthouse'),
  ('United States Courthouse', 'Western District of Missouri - St. Joseph', 'district_court', 'Western District of Missouri', 'Eighth Circuit', '201 North 8th Street', 'St. Joseph', 'MO', '64501', 39.7675, -94.8467, 'Divisional courthouse'),
  -- Montana
  ('United States Courthouse', 'District of Montana - Billings', 'district_court', 'District of Montana', 'Ninth Circuit', '2601 2nd Avenue North', 'Billings', 'MT', '59101', 45.7833, -108.5007, 'Divisional courthouse'),
  ('United States Courthouse', 'District of Montana - Butte', 'district_court', 'District of Montana', 'Ninth Circuit', '400 North Main Street', 'Butte', 'MT', '59701', 46.0031, -112.5347, 'Divisional courthouse'),
  ('United States Courthouse', 'District of Montana - Great Falls', 'district_court', 'District of Montana', 'Ninth Circuit', '125 Central Avenue', 'Great Falls', 'MT', '59401', 47.5053, -111.3008, 'Divisional courthouse'),
  ('United States Courthouse', 'District of Montana - Helena', 'district_court', 'District of Montana', 'Ninth Circuit', '901 Front Street', 'Helena', 'MT', '59601', 46.5891, -112.0391, 'Divisional courthouse'),
  -- Nebraska
  ('United States Courthouse', 'District of Nebraska - North Platte', 'district_court', 'District of Nebraska', 'Eighth Circuit', '300 East Third Street', 'North Platte', 'NE', '69101', 41.1359, -100.7628, 'Divisional courthouse'),
  -- Nevada
  ('United States Courthouse', 'District of Nevada - Elko', 'magistrate_court', 'District of Nevada', 'Ninth Circuit', '2001 Errecart Boulevard', 'Elko', 'NV', '89801', 40.8325, -115.7631, 'Divisional location'),
  -- New Hampshire
  ('United States Courthouse', 'District of New Hampshire - Littleton', 'magistrate_court', 'District of New Hampshire', 'First Circuit', 'Post Office Building', 'Littleton', 'NH', '03561', 44.3061, -71.7700, 'Divisional location'),
  -- New Jersey
  ('United States Courthouse', 'District of New Jersey - Newark (Post Office)', 'district_court', 'District of New Jersey', 'Third Circuit', 'Federal Square', 'Newark', 'NJ', '07102', 40.7357, -74.1724, 'Secondary location'),
  -- New Mexico
  ('United States Courthouse', 'District of New Mexico - Santa Fe', 'district_court', 'District of New Mexico', 'Tenth Circuit', '106 South Federal Place', 'Santa Fe', 'NM', '87501', 35.6870, -105.9397, 'Divisional courthouse'),
  ('United States Courthouse', 'District of New Mexico - Las Cruces', 'district_court', 'District of New Mexico', 'Tenth Circuit', '100 North Church Street', 'Las Cruces', 'NM', '88001', 32.3122, -106.7783, 'Divisional courthouse'),
  ('United States Courthouse', 'District of New Mexico - Roswell', 'district_court', 'District of New Mexico', 'Tenth Circuit', '500 North Richardson Avenue', 'Roswell', 'NM', '88201', 33.3942, -104.5231, 'Divisional courthouse'),
  -- New York (Northern)
  ('United States Courthouse', 'Northern District of New York - Binghamton', 'district_court', 'Northern District of New York', 'Second Circuit', '15 Henry Street', 'Binghamton', 'NY', '13901', 42.1000, -75.9117, 'Divisional courthouse'),
  ('United States Courthouse', 'Northern District of New York - Utica', 'district_court', 'Northern District of New York', 'Second Circuit', '10 Broad Street', 'Utica', 'NY', '13501', 43.1008, -75.2328, 'Divisional courthouse'),
  ('United States Courthouse', 'Northern District of New York - Syracuse (Hanley)', 'bankruptcy_court', 'Northern District of New York', 'Second Circuit', '100 South Clinton Street', 'Syracuse', 'NY', '13261', 43.0481, -76.1500, 'Bankruptcy division'),
  -- New York (Southern)
  ('United States Courthouse', 'Southern District of New York - Manhattan (Foley Square)', 'bankruptcy_court', 'Southern District of New York', 'Second Circuit', 'One Bowling Green', 'New York', 'NY', '10004', 40.7040, -74.0130, 'Bankruptcy division'),
  ('United States Courthouse', 'Southern District of New York - Poughkeepsie', 'magistrate_court', 'Southern District of New York', 'Second Circuit', '353 Main Street', 'Poughkeepsie', 'NY', '12601', 41.7003, -73.9236, 'Divisional location'),
  -- New York (Eastern)
  ('United States Courthouse', 'Eastern District of New York - Brooklyn (Bankruptcy)', 'bankruptcy_court', 'Eastern District of New York', 'Second Circuit', '271-C Cadman Plaza East', 'Brooklyn', 'NY', '11201', 40.6940, -73.9900, 'Bankruptcy division'),
  -- New York (Western)
  ('United States Courthouse', 'Western District of New York - Buffalo (Bankruptcy)', 'bankruptcy_court', 'Western District of New York', 'Second Circuit', '300 Pearl Street', 'Buffalo', 'NY', '14202', 42.8860, -78.8780, 'Bankruptcy division'),
  -- North Carolina (Eastern)
  ('United States Courthouse', 'Eastern District of North Carolina - Wilmington', 'district_court', 'Eastern District of North Carolina', 'Fourth Circuit', '201 Chestnut Street', 'Wilmington', 'NC', '28401', 34.2347, -77.9481, 'Divisional courthouse'),
  ('United States Courthouse', 'Eastern District of North Carolina - New Bern', 'district_court', 'Eastern District of North Carolina', 'Fourth Circuit', '413 Middle Street', 'New Bern', 'NC', '28560', 35.1083, -77.0442, 'Divisional courthouse'),
  ('United States Courthouse', 'Eastern District of North Carolina - Elizabeth City', 'district_court', 'Eastern District of North Carolina', 'Fourth Circuit', '306 East Main Street', 'Elizabeth City', 'NC', '27909', 36.3008, -76.2231, 'Divisional courthouse'),
  ('United States Courthouse', 'Eastern District of North Carolina - Greenville', 'district_court', 'Eastern District of North Carolina', 'Fourth Circuit', '201 West 5th Street', 'Greenville', 'NC', '27858', 35.6125, -77.3664, 'Divisional courthouse'),
  -- North Carolina (Middle)
  ('United States Courthouse', 'Middle District of North Carolina - Winston-Salem', 'district_court', 'Middle District of North Carolina', 'Fourth Circuit', '251 North Main Street', 'Winston-Salem', 'NC', '27101', 36.0997, -80.2442, 'Divisional courthouse'),
  ('United States Courthouse', 'Middle District of North Carolina - Durham', 'district_court', 'Middle District of North Carolina', 'Fourth Circuit', '323 East Chapel Hill Street', 'Durham', 'NC', '27701', 35.9939, -78.8986, 'Divisional courthouse'),
  -- North Carolina (Western)
  ('United States Courthouse', 'Western District of North Carolina - Asheville', 'district_court', 'Western District of North Carolina', 'Fourth Circuit', '100 Otis Street', 'Asheville', 'NC', '28801', 35.5951, -82.5515, 'Divisional courthouse'),
  ('United States Courthouse', 'Western District of North Carolina - Statesville', 'district_court', 'Western District of North Carolina', 'Fourth Circuit', '200 West Broad Street', 'Statesville', 'NC', '28677', 35.7825, -80.8883, 'Divisional courthouse'),
  -- North Dakota
  ('United States Courthouse', 'District of North Dakota - Bismarck', 'district_court', 'District of North Dakota', 'Eighth Circuit', '220 East Rosser Avenue', 'Bismarck', 'ND', '58501', 46.8083, -100.7836, 'Divisional courthouse'),
  ('United States Courthouse', 'District of North Dakota - Grand Forks', 'district_court', 'District of North Dakota', 'Eighth Circuit', '102 North Fourth Street', 'Grand Forks', 'ND', '58203', 47.9253, -97.0328, 'Divisional courthouse'),
  ('United States Courthouse', 'District of North Dakota - Minot', 'district_court', 'District of North Dakota', 'Eighth Circuit', '100 First Street SW', 'Minot', 'ND', '58701', 48.2331, -101.2922, 'Divisional courthouse'),
  -- Ohio (Northern)
  ('United States Courthouse', 'Northern District of Ohio - Akron', 'district_court', 'Northern District of Ohio', 'Sixth Circuit', '2 South Main Street', 'Akron', 'OH', '44308', 41.0814, -81.5189, 'Divisional courthouse'),
  ('United States Courthouse', 'Northern District of Ohio - Toledo', 'district_court', 'Northern District of Ohio', 'Sixth Circuit', '1716 Spielbusch Avenue', 'Toledo', 'OH', '43604', 41.6528, -83.5378, 'Divisional courthouse'),
  ('United States Courthouse', 'Northern District of Ohio - Youngstown', 'district_court', 'Northern District of Ohio', 'Sixth Circuit', '125 Market Street', 'Youngstown', 'OH', '44503', 41.0997, -80.6497, 'Divisional courthouse'),
  -- Ohio (Southern)
  ('United States Courthouse', 'Southern District of Ohio - Dayton', 'district_court', 'Southern District of Ohio', 'Sixth Circuit', '200 West Second Street', 'Dayton', 'OH', '45402', 39.7589, -84.1917, 'Divisional courthouse'),
  -- Oklahoma (Western)
  ('United States Courthouse', 'Western District of Oklahoma - Enid', 'magistrate_court', 'Western District of Oklahoma', 'Tenth Circuit', 'Post Office Building', 'Enid', 'OK', '73701', 36.3956, -97.8783, 'Divisional location'),
  -- Oklahoma (Northern)
  ('United States Courthouse', 'Northern District of Oklahoma - Bartlesville', 'magistrate_court', 'Northern District of Oklahoma', 'Tenth Circuit', 'Post Office Building', 'Bartlesville', 'OK', '74003', 36.7472, -95.9761, 'Divisional location'),
  -- Oklahoma (Eastern)
  ('United States Courthouse', 'Eastern District of Oklahoma - Muskogee', 'district_court', 'Eastern District of Oklahoma', 'Tenth Circuit', '101 North 5th Street', 'Muskogee', 'OK', '74401', 35.7503, -95.3703, 'Main district courthouse'),
  -- Oregon
  ('United States Courthouse', 'District of Oregon - Eugene', 'district_court', 'District of Oregon', 'Ninth Circuit', '405 East Eighth Avenue', 'Eugene', 'OR', '97401', 44.0522, -123.0867, 'Divisional courthouse'),
  ('United States Courthouse', 'District of Oregon - Medford', 'district_court', 'District of Oregon', 'Ninth Circuit', '310 West Sixth Street', 'Medford', 'OR', '97501', 42.3267, -122.8755, 'Divisional courthouse'),
  ('United States Courthouse', 'District of Oregon - Pendleton', 'district_court', 'District of Oregon', 'Ninth Circuit', '104 SW Dorion Avenue', 'Pendleton', 'OR', '97801', 45.6721, -118.7886, 'Divisional courthouse'),
  -- Pennsylvania (Eastern)
  ('United States Courthouse', 'Eastern District of Pennsylvania - Reading', 'district_court', 'Eastern District of Pennsylvania', 'Third Circuit', 'Madison Building', 'Reading', 'PA', '19601', 40.3356, -75.9267, 'Divisional courthouse'),
  -- Pennsylvania (Middle)
  ('United States Courthouse', 'Middle District of Pennsylvania - Williamsport', 'district_court', 'Middle District of Pennsylvania', 'Third Circuit', '240 West Third Street', 'Williamsport', 'PA', '17701', 41.2411, -77.0011, 'Divisional courthouse'),
  -- Pennsylvania (Western)
  ('United States Courthouse', 'Western District of Pennsylvania - Johnstown', 'district_court', 'Western District of Pennsylvania', 'Third Circuit', '319 Washington Street', 'Johnstown', 'PA', '15901', 40.3267, -78.9219, 'Divisional courthouse'),
  -- Rhode Island
  ('United States Courthouse', 'District of Rhode Island - Providence (Bankruptcy)', 'bankruptcy_court', 'District of Rhode Island', 'First Circuit', '380 Westminster Street', 'Providence', 'RI', '02903', 41.8240, -71.4128, 'Bankruptcy division'),
  -- South Carolina
  ('United States Courthouse', 'District of South Carolina - Charleston', 'district_court', 'District of South Carolina', 'Fourth Circuit', '85 Broad Street', 'Charleston', 'SC', '29401', 32.7765, -79.9311, 'Divisional courthouse'),
  ('United States Courthouse', 'District of South Carolina - Greenville', 'district_court', 'District of South Carolina', 'Fourth Circuit', '300 East Washington Street', 'Greenville', 'SC', '29601', 34.8526, -82.3940, 'Divisional courthouse'),
  ('United States Courthouse', 'District of South Carolina - Florence', 'district_court', 'District of South Carolina', 'Fourth Circuit', '401 West Evans Street', 'Florence', 'SC', '29501', 34.1953, -79.7628, 'Divisional courthouse'),
  ('United States Courthouse', 'District of South Carolina - Aiken', 'district_court', 'District of South Carolina', 'Fourth Circuit', '223 Park Avenue SW', 'Aiken', 'SC', '29801', 33.5604, -81.7194, 'Divisional courthouse'),
  ('United States Courthouse', 'District of South Carolina - Anderson', 'district_court', 'District of South Carolina', 'Fourth Circuit', '315 South McDuffie Street', 'Anderson', 'SC', '29624', 34.5034, -82.6501, 'Divisional courthouse'),
  ('United States Courthouse', 'District of South Carolina - Spartanburg', 'district_court', 'District of South Carolina', 'Fourth Circuit', '201 Magnolia Street', 'Spartanburg', 'SC', '29306', 34.9496, -81.9320, 'Divisional courthouse'),
  -- South Dakota
  ('United States Courthouse', 'District of South Dakota - Sioux Falls', 'district_court', 'District of South Dakota', 'Eighth Circuit', '400 South Phillips Avenue', 'Sioux Falls', 'SD', '57104', 43.5446, -96.7311, 'Main district courthouse'),
  ('United States Courthouse', 'District of South Dakota - Pierre', 'district_court', 'District of South Dakota', 'Eighth Circuit', '225 South Pierre Street', 'Pierre', 'SD', '57501', 44.3683, -100.3514, 'Divisional courthouse'),
  ('United States Courthouse', 'District of South Dakota - Aberdeen', 'district_court', 'District of South Dakota', 'Eighth Circuit', '102 Fourth Avenue SE', 'Aberdeen', 'SD', '57401', 45.4647, -98.4861, 'Divisional courthouse'),
  -- Tennessee (Eastern)
  ('United States Courthouse', 'Eastern District of Tennessee - Chattanooga', 'district_court', 'Eastern District of Tennessee', 'Sixth Circuit', '900 Georgia Avenue', 'Chattanooga', 'TN', '37402', 35.0456, -85.3097, 'Divisional courthouse'),
  ('United States Courthouse', 'Eastern District of Tennessee - Greeneville', 'district_court', 'Eastern District of Tennessee', 'Sixth Circuit', '220 West Depot Street', 'Greeneville', 'TN', '37743', 36.1631, -82.8311, 'Divisional courthouse'),
  -- Tennessee (Middle)
  ('United States Courthouse', 'Middle District of Tennessee - Columbia', 'district_court', 'Middle District of Tennessee', 'Sixth Circuit', '815 South Garden Street', 'Columbia', 'TN', '38401', 35.6151, -87.0353, 'Divisional courthouse'),
  ('United States Courthouse', 'Middle District of Tennessee - Cookeville', 'district_court', 'Middle District of Tennessee', 'Sixth Circuit', '9 East Broad Street', 'Cookeville', 'TN', '38501', 36.1628, -85.5017, 'Divisional courthouse'),
  -- Tennessee (Western)
  ('United States Courthouse', 'Western District of Tennessee - Jackson', 'district_court', 'Western District of Tennessee', 'Sixth Circuit', '111 South Highland Avenue', 'Jackson', 'TN', '38301', 35.6145, -88.8139, 'Divisional courthouse'),
  -- Texas (Northern)
  ('United States Courthouse', 'Northern District of Texas - Abilene', 'district_court', 'Northern District of Texas', 'Fifth Circuit', '341 Pine Street', 'Abilene', 'TX', '79601', 32.4487, -99.7331, 'Divisional courthouse'),
  ('United States Courthouse', 'Northern District of Texas - Amarillo', 'district_court', 'Northern District of Texas', 'Fifth Circuit', '205 SE Fifth Avenue', 'Amarillo', 'TX', '79101', 35.2220, -101.8314, 'Divisional courthouse'),
  ('United States Courthouse', 'Northern District of Texas - Lubbock', 'district_court', 'Northern District of Texas', 'Fifth Circuit', '1205 Texas Avenue', 'Lubbock', 'TX', '79401', 33.5779, -101.8553, 'Divisional courthouse'),
  ('United States Courthouse', 'Northern District of Texas - San Angelo', 'district_court', 'Northern District of Texas', 'Fifth Circuit', '33 East Twohig Avenue', 'San Angelo', 'TX', '76903', 31.4638, -100.4370, 'Divisional courthouse'),
  ('United States Courthouse', 'Northern District of Texas - Wichita Falls', 'district_court', 'Northern District of Texas', 'Fifth Circuit', '1000 Lamar Street', 'Wichita Falls', 'TX', '76301', 33.9137, -98.4911, 'Divisional courthouse'),
  -- Texas (Southern)
  ('United States Courthouse', 'Southern District of Texas - Brownsville', 'district_court', 'Southern District of Texas', 'Fifth Circuit', '600 East Harrison Street', 'Brownsville', 'TX', '78520', 25.9017, -97.4975, 'Divisional courthouse'),
  ('United States Courthouse', 'Southern District of Texas - Corpus Christi', 'district_court', 'Southern District of Texas', 'Fifth Circuit', '1133 North Shoreline Boulevard', 'Corpus Christi', 'TX', '78401', 27.8006, -97.3964, 'Divisional courthouse'),
  ('United States Courthouse', 'Southern District of Texas - Laredo', 'district_court', 'Southern District of Texas', 'Fifth Circuit', '1300 Victoria Street', 'Laredo', 'TX', '78040', 27.5036, -99.5075, 'Divisional courthouse'),
  ('United States Courthouse', 'Southern District of Texas - McAllen', 'district_court', 'Southern District of Texas', 'Fifth Circuit', '1701 West Business Highway 83', 'McAllen', 'TX', '78501', 26.2034, -98.2300, 'Divisional courthouse'),
  ('United States Courthouse', 'Southern District of Texas - Victoria', 'district_court', 'Southern District of Texas', 'Fifth Circuit', '312 South Main Street', 'Victoria', 'TX', '77901', 28.8053, -97.0036, 'Divisional courthouse'),
  -- Texas (Eastern)
  ('United States Courthouse', 'Eastern District of Texas - Lufkin', 'district_court', 'Eastern District of Texas', 'Fifth Circuit', '104 North Third Street', 'Lufkin', 'TX', '75901', 31.3382, -94.7294, 'Divisional courthouse'),
  ('United States Courthouse', 'Eastern District of Texas - Marshall', 'district_court', 'Eastern District of Texas', 'Fifth Circuit', '100 East Houston Street', 'Marshall', 'TX', '75670', 32.5449, -94.3674, 'Divisional courthouse'),
  ('United States Courthouse', 'Eastern District of Texas - Sherman', 'district_court', 'Eastern District of Texas', 'Fifth Circuit', '101 East Pecan Street', 'Sherman', 'TX', '75090', 33.6357, -96.6089, 'Divisional courthouse'),
  ('United States Courthouse', 'Eastern District of Texas - Texarkana', 'district_court', 'Eastern District of Texas', 'Fifth Circuit', '500 State Line Avenue', 'Texarkana', 'TX', '75501', 33.4251, -94.0436, 'Divisional courthouse'),
  -- Texas (Western)
  ('United States Courthouse', 'Western District of Texas - Waco', 'district_court', 'Western District of Texas', 'Fifth Circuit', '800 Franklin Avenue', 'Waco', 'TX', '76701', 31.5590, -97.1467, 'Divisional courthouse'),
  ('United States Courthouse', 'Western District of Texas - Del Rio', 'district_court', 'Western District of Texas', 'Fifth Circuit', '111 East Broadway', 'Del Rio', 'TX', '78840', 29.3627, -100.8969, 'Divisional courthouse'),
  ('United States Courthouse', 'Western District of Texas - Midland', 'district_court', 'Western District of Texas', 'Fifth Circuit', '200 East Wall Street', 'Midland', 'TX', '79701', 31.9972, -102.0778, 'Divisional courthouse'),
  ('United States Courthouse', 'Western District of Texas - Pecos', 'district_court', 'Western District of Texas', 'Fifth Circuit', '410 South Cedar Street', 'Pecos', 'TX', '79772', 31.4226, -103.4933, 'Divisional courthouse'),
  -- Utah
  ('United States Courthouse', 'District of Utah - St. George', 'district_court', 'District of Utah', 'Tenth Circuit', '206 West Tabernacle Street', 'St. George', 'UT', '84770', 37.1041, -113.5842, 'Divisional courthouse'),
  -- Vermont
  ('United States Courthouse', 'District of Vermont - Brattleboro', 'magistrate_court', 'District of Vermont', 'Second Circuit', 'Post Office Building', 'Brattleboro', 'VT', '05301', 42.8509, -72.5578, 'Divisional location'),
  -- Virginia (Eastern)
  ('United States Courthouse', 'Eastern District of Virginia - Newport News', 'district_court', 'Eastern District of Virginia', 'Fourth Circuit', '2400 West Avenue', 'Newport News', 'VA', '23607', 36.9786, -76.4328, 'Divisional courthouse'),
  -- Virginia (Western)
  ('United States Courthouse', 'Western District of Virginia - Abingdon', 'district_court', 'Western District of Virginia', 'Fourth Circuit', '180 West Main Street', 'Abingdon', 'VA', '24210', 36.7128, -81.9706, 'Divisional courthouse'),
  ('United States Courthouse', 'Western District of Virginia - Big Stone Gap', 'district_court', 'Western District of Virginia', 'Fourth Circuit', '322 East Wood Avenue', 'Big Stone Gap', 'VA', '24219', 36.8697, -82.7750, 'Divisional courthouse'),
  ('United States Courthouse', 'Western District of Virginia - Charlottesville', 'district_court', 'Western District of Virginia', 'Fourth Circuit', '255 West Main Street', 'Charlottesville', 'VA', '22902', 38.0293, -78.4767, 'Divisional courthouse'),
  ('United States Courthouse', 'Western District of Virginia - Danville', 'district_court', 'Western District of Virginia', 'Fourth Circuit', '212 West Main Street', 'Danville', 'VA', '24541', 36.5859, -79.3950, 'Divisional courthouse'),
  ('United States Courthouse', 'Western District of Virginia - Harrisonburg', 'district_court', 'Western District of Virginia', 'Fourth Circuit', '116 North Main Street', 'Harrisonburg', 'VA', '22802', 38.4496, -78.8689, 'Divisional courthouse'),
  ('United States Courthouse', 'Western District of Virginia - Lynchburg', 'district_court', 'Western District of Virginia', 'Fourth Circuit', '1101 Court Street', 'Lynchburg', 'VA', '24504', 37.4137, -79.1422, 'Divisional courthouse'),
  -- Washington (Eastern)
  ('United States Courthouse', 'Eastern District of Washington - Yakima', 'district_court', 'Eastern District of Washington', 'Ninth Circuit', '25 South 3rd Street', 'Yakima', 'WA', '98901', 46.6022, -120.5058, 'Divisional courthouse'),
  ('United States Courthouse', 'Eastern District of Washington - Richland', 'district_court', 'Eastern District of Washington', 'Ninth Circuit', '825 Jadwin Avenue', 'Richland', 'WA', '99352', 46.2856, -119.2711, 'Divisional courthouse'),
  -- Washington (Western)
  ('United States Courthouse', 'Western District of Washington - Tacoma', 'district_court', 'Western District of Washington', 'Ninth Circuit', '1717 Pacific Avenue', 'Tacoma', 'WA', '98402', 47.2446, -122.4347, 'Divisional courthouse'),
  -- West Virginia (Northern)
  ('United States Courthouse', 'Northern District of West Virginia - Wheeling', 'district_court', 'Northern District of West Virginia', 'Fourth Circuit', '1125 Chapline Street', 'Wheeling', 'WV', '26003', 40.0639, -80.7208, 'Main district courthouse'),
  ('United States Courthouse', 'Northern District of West Virginia - Clarksburg', 'district_court', 'Northern District of West Virginia', 'Fourth Circuit', '500 West Pike Street', 'Clarksburg', 'WV', '26301', 39.2806, -80.3403, 'Divisional courthouse'),
  ('United States Courthouse', 'Northern District of West Virginia - Elkins', 'district_court', 'Northern District of West Virginia', 'Fourth Circuit', '300 Third Street', 'Elkins', 'WV', '26241', 38.9259, -79.8467, 'Divisional courthouse'),
  -- West Virginia (Southern)
  ('United States Courthouse', 'Southern District of West Virginia - Huntington', 'district_court', 'Southern District of West Virginia', 'Fourth Circuit', '845 Fifth Avenue', 'Huntington', 'WV', '25701', 38.4192, -82.4453, 'Divisional courthouse'),
  ('United States Courthouse', 'Southern District of West Virginia - Beckley', 'district_court', 'Southern District of West Virginia', 'Fourth Circuit', '110 North Heber Street', 'Beckley', 'WV', '25801', 37.7784, -81.1881, 'Divisional courthouse'),
  ('United States Courthouse', 'Southern District of West Virginia - Bluefield', 'district_court', 'Southern District of West Virginia', 'Fourth Circuit', '601 Federal Street', 'Bluefield', 'WV', '24701', 37.2698, -81.2222, 'Divisional courthouse'),
  -- Wisconsin (Eastern)
  ('United States Courthouse', 'Eastern District of Wisconsin - Green Bay', 'district_court', 'Eastern District of Wisconsin', 'Seventh Circuit', '125 South Jefferson Street', 'Green Bay', 'WI', '54301', 44.5133, -88.0158, 'Divisional courthouse'),
  -- Wisconsin (Western)
  ('United States Courthouse', 'Western District of Wisconsin - Eau Claire', 'magistrate_court', 'Western District of Wisconsin', 'Seventh Circuit', '500 South Barstow Street', 'Eau Claire', 'WI', '54701', 44.8113, -91.4985, 'Divisional location'),
  -- Wyoming
  ('United States Courthouse', 'District of Wyoming - Cheyenne', 'district_court', 'District of Wyoming', 'Tenth Circuit', '2120 Capitol Avenue', 'Cheyenne', 'WY', '82001', 41.1400, -104.8202, 'Main district courthouse'),
  ('United States Courthouse', 'District of Wyoming - Jackson', 'magistrate_court', 'District of Wyoming', 'Tenth Circuit', 'Post Office Building', 'Jackson', 'WY', '83001', 43.4799, -110.7624, 'Divisional location'),
  ('United States Courthouse', 'District of Wyoming - Yellowstone', 'magistrate_court', 'District of Wyoming', 'Tenth Circuit', 'Mammoth Hot Springs', 'Yellowstone National Park', 'WY', '82190', 44.9764, -110.6997, 'Yellowstone division');
INSERT INTO app.federal_courthouses 
  (name, short_name, courthouse_type, district, circuit, address_line1, city, state, postal_code, latitude, longitude, notes)
VALUES
  -- FIRST CIRCUIT (Divisional / Additional)
  ('Clemente Ruiz-Nazario United States Courthouse', 'District of Puerto Rico - Hato Rey (Nazario)', 'district_court', 'District of Puerto Rico', 'First Circuit', '150 Carlos Chardon Avenue', 'San Juan', 'PR', '00918', 18.4275, -66.0642, 'Additional SDPR location'),
  ('Luis A. Ferre United States Courthouse and Post Office', 'District of Puerto Rico - Ponce', 'district_court', 'District of Puerto Rico', 'First Circuit', '201 West Hostos Avenue', 'Ponce', 'PR', '00731', 18.0111, -66.6142, 'Divisional courthouse'),
  
  -- SECOND CIRCUIT (Divisional / Additional)
  ('United States Courthouse', 'District of Connecticut - Waterbury', 'magistrate_court', 'District of Connecticut', 'Second Circuit', '147 Bank Street', 'Waterbury', 'CT', '06702', 41.5544, -73.0417, 'Divisional courthouse'),
  ('Uniondale United States Courthouse', 'Eastern District of New York - Uniondale', 'district_court', 'Eastern District of New York', 'Second Circuit', '100 Federal Plaza', 'Uniondale', 'NY', '11553', 40.7256, -73.5939, 'Long Island divisional office'),
  ('United States Courthouse', 'Northern District of New York - Plattsburgh', 'magistrate_court', 'Northern District of New York', 'Second Circuit', '14 Margaret Street', 'Plattsburgh', 'NY', '12901', 44.6994, -73.4528, 'Divisional location'),
  ('United States Courthouse', 'Southern District of New York - Manhattan (500 Pearl)', 'district_court', 'Southern District of New York', 'Second Circuit', '500 Pearl Street', 'New York', 'NY', '10007', 40.7140, -74.0020, 'Daniel Patrick Moynihan building'),
  ('United States Courthouse', 'Southern District of New York - Manhattan (40 Foley)', 'district_court', 'Southern District of New York', 'Second Circuit', '40 Foley Square', 'New York', 'NY', '10007', 40.7143, -74.0055, 'Thurgood Marshall building'),
  ('United States Courthouse', 'Southern District of New York - Poughkeepsie (District)', 'district_court', 'Southern District of New York', 'Second Circuit', '353 Main Street', 'Poughkeepsie', 'NY', '12601', 41.7003, -73.9236, 'Divisional location'),
  ('United States Courthouse', 'District of Vermont - Brattleboro (District)', 'district_court', 'District of Vermont', 'Second Circuit', '204 Main Street', 'Brattleboro', 'VT', '05301', 42.8509, -72.5578, 'Divisional courthouse'),

  -- THIRD CIRCUIT (Divisional / Additional)
  ('United States Courthouse', 'Middle District of Pennsylvania - Williamsport (District)', 'district_court', 'Middle District of Pennsylvania', 'Third Circuit', '240 West Third Street', 'Williamsport', 'PA', '17701', 41.2411, -77.0011, 'Divisional courthouse'),
  ('United States Courthouse', 'Western District of Pennsylvania - Johnstown (District)', 'district_court', 'Western District of Pennsylvania', 'Third Circuit', '319 Washington Street', 'Johnstown', 'PA', '15901', 40.3267, -78.9219, 'Divisional courthouse')
ON CONFLICT DO NOTHING;
INSERT INTO app.federal_courthouses 
  (name, short_name, courthouse_type, district, circuit, address_line1, city, state, postal_code, latitude, longitude, notes)
VALUES
  -- FOURTH CIRCUIT (Divisional / Additional)
  ('United States Courthouse', 'Western District of North Carolina - Bryson City', 'district_court', 'Western District of North Carolina', 'Fourth Circuit', '155 Main Street', 'Bryson City', 'NC', '28713', 35.4297, -83.4467, 'Divisional courthouse'),
  ('United States Courthouse', 'District of South Carolina - Beaufort', 'magistrate_court', 'District of South Carolina', 'Fourth Circuit', '1501 Bay Street', 'Beaufort', 'SC', '29902', 32.4315, -80.6698, 'Divisional location'),
  ('United States Courthouse', 'District of South Carolina - Rock Hill', 'magistrate_court', 'District of South Carolina', 'Fourth Circuit', '210 Main Street', 'Rock Hill', 'SC', '29730', 34.9249, -81.0251, 'Divisional location'),
  ('United States Courthouse', 'Western District of Virginia - Harrisonburg (District)', 'district_court', 'Western District of Virginia', 'Fourth Circuit', '116 North Main Street', 'Harrisonburg', 'VA', '22802', 38.4496, -78.8689, 'Main divisional building'),
  ('United States Courthouse', 'Southern District of West Virginia - Lewisburg', 'magistrate_court', 'Southern District of West Virginia', 'Fourth Circuit', '200 North Court Street', 'Lewisburg', 'WV', '24901', 37.8037, -80.4459, 'Divisional location'),
  ('United States Courthouse', 'Southern District of West Virginia - Parkersburg', 'district_court', 'Southern District of West Virginia', 'Fourth Circuit', '425 Juliana Street', 'Parkersburg', 'WV', '26101', 39.2667, -81.5611, 'Divisional courthouse'),

  -- FIFTH CIRCUIT (Divisional / Additional)
  ('United States Courthouse', 'Western District of Louisiana - Alexandria (District)', 'district_court', 'Western District of Louisiana', 'Fifth Circuit', '515 Murray Street', 'Alexandria', 'LA', '71301', 31.3113, -92.4450, 'Divisional courthouse'),
  ('United States Courthouse', 'Western District of Louisiana - Monroe (District)', 'district_court', 'Western District of Louisiana', 'Fifth Circuit', '201 Jackson Street', 'Monroe', 'LA', '71201', 32.5007, -92.1194, 'Divisional courthouse'),
  ('United States Courthouse', 'Northern District of Texas - Abilene (District)', 'district_court', 'Northern District of Texas', 'Fifth Circuit', '341 Pine Street', 'Abilene', 'TX', '79601', 32.4487, -99.7331, 'Divisional courthouse'),
  ('United States Courthouse', 'Northern District of Texas - Amarillo (District)', 'district_court', 'Northern District of Texas', 'Fifth Circuit', '205 SE Fifth Avenue', 'Amarillo', 'TX', '79101', 35.2220, -101.8314, 'Divisional courthouse'),
  ('United States Courthouse', 'Northern District of Texas - San Angelo (District)', 'district_court', 'Northern District of Texas', 'Fifth Circuit', '33 East Twohig Avenue', 'San Angelo', 'TX', '76903', 31.4638, -100.4370, 'Divisional courthouse'),
  ('United States Courthouse', 'Southern District of Texas - Brownsville (District)', 'district_court', 'Southern District of Texas', 'Fifth Circuit', '600 East Harrison Street', 'Brownsville', 'TX', '78520', 25.9017, -97.4975, 'Divisional courthouse'),
  ('United States Courthouse', 'Southern District of Texas - Corpus Christi (District)', 'district_court', 'Southern District of Texas', 'Fifth Circuit', '1133 North Shoreline Boulevard', 'Corpus Christi', 'TX', '78401', 27.8006, -97.3964, 'Divisional courthouse'),
  ('United States Courthouse', 'Southern District of Texas - Laredo (District)', 'district_court', 'Southern District of Texas', 'Fifth Circuit', '1300 Victoria Street', 'Laredo', 'TX', '78040', 27.5036, -99.5075, 'Divisional courthouse'),
  ('United States Courthouse', 'Southern District of Texas - McAllen (District)', 'district_court', 'Southern District of Texas', 'Fifth Circuit', '1701 West Business Highway 83', 'McAllen', 'TX', '78501', 26.2034, -98.2300, 'Divisional courthouse'),
  ('United States Courthouse', 'Western District of Texas - Midland (District)', 'district_court', 'Western District of Texas', 'Fifth Circuit', '200 East Wall Street', 'Midland', 'TX', '79701', 31.9972, -102.0778, 'Divisional courthouse'),
  ('United States Courthouse', 'Western District of Texas - Del Rio (District)', 'district_court', 'Western District of Texas', 'Fifth Circuit', '111 East Broadway', 'Del Rio', 'TX', '78840', 29.3627, -100.8969, 'Divisional courthouse'),
  ('United States Courthouse', 'Western District of Texas - Waco (District)', 'district_court', 'Western District of Texas', 'Fifth Circuit', '800 Franklin Avenue', 'Waco', 'TX', '76701', 31.5590, -97.1467, 'Divisional courthouse')
ON CONFLICT DO NOTHING;
INSERT INTO app.federal_courthouses 
  (name, short_name, courthouse_type, district, circuit, address_line1, city, state, postal_code, latitude, longitude, notes)
VALUES
  -- SIXTH CIRCUIT (Divisional / Additional)
  ('United States Courthouse', 'Eastern District of Michigan - Flint (District)', 'district_court', 'Eastern District of Michigan', 'Sixth Circuit', '600 Church Street', 'Flint', 'MI', '48502', 43.0125, -83.6931, 'Divisional courthouse'),
  ('United States Courthouse', 'Western District of Michigan - Lansing (District)', 'district_court', 'Western District of Michigan', 'Sixth Circuit', '315 West Allegan Street', 'Lansing', 'MI', '48933', 42.7325, -84.5556, 'Divisional courthouse'),
  ('United States Courthouse', 'Western District of Michigan - Marquette (District)', 'district_court', 'Western District of Michigan', 'Sixth Circuit', '202 West Washington Street', 'Marquette', 'MI', '49855', 46.5436, -87.3953, 'Upper Peninsula divisional office'),
  ('United States Courthouse', 'Northern District of Ohio - Toledo (District)', 'district_court', 'Northern District of Ohio', 'Sixth Circuit', '1716 Spielbusch Avenue', 'Toledo', 'OH', '43604', 41.6528, -83.5378, 'Divisional courthouse'),
  ('United States Courthouse', 'Southern District of Ohio - Dayton (District)', 'district_court', 'Southern District of Ohio', 'Sixth Circuit', '200 West Second Street', 'Dayton', 'OH', '45402', 39.7589, -84.1917, 'Divisional courthouse'),
  ('United States Courthouse', 'Eastern District of Tennessee - Chattanooga (District)', 'district_court', 'Eastern District of Tennessee', 'Sixth Circuit', '900 Georgia Avenue', 'Chattanooga', 'TN', '37402', 35.0456, -85.3097, 'Divisional courthouse'),
  ('United States Courthouse', 'Middle District of Tennessee - Columbia (District)', 'district_court', 'Middle District of Tennessee', 'Sixth Circuit', '815 South Garden Street', 'Columbia', 'TN', '38401', 35.6151, -87.0353, 'Divisional courthouse'),

  -- SEVENTH CIRCUIT (Divisional / Additional)
  ('United States Courthouse', 'Northern District of Illinois - Rockford (District)', 'district_court', 'Northern District of Illinois', 'Seventh Circuit', '327 South Church Street', 'Rockford', 'IL', '61101', 42.2711, -89.0940, 'Divisional courthouse'),
  ('United States Courthouse', 'Central District of Illinois - Peoria (District)', 'district_court', 'Central District of Illinois', 'Seventh Circuit', '100 NE Monroe Street', 'Peoria', 'IL', '61602', 40.6936, -89.5889, 'Divisional courthouse'),
  ('United States Courthouse', 'Central District of Illinois - Urbana (District)', 'district_court', 'Central District of Illinois', 'Seventh Circuit', '201 South Vine Street', 'Urbana', 'IL', '61802', 40.1106, -88.2072, 'Divisional courthouse'),
  ('United States Courthouse', 'Northern District of Indiana - South Bend (District)', 'district_court', 'Northern District of Indiana', 'Seventh Circuit', '204 South Main Street', 'South Bend', 'IN', '46601', 41.6764, -86.2520, 'Divisional courthouse'),
  ('United States Courthouse', 'Southern District of Indiana - Evansville (District)', 'district_court', 'Southern District of Indiana', 'Seventh Circuit', '101 NW Martin Luther King Jr. Boulevard', 'Evansville', 'IN', '47708', 37.9716, -87.5711, 'Divisional courthouse'),
  ('United States Courthouse', 'Western District of Wisconsin - Eau Claire (District)', 'district_court', 'Western District of Wisconsin', 'Seventh Circuit', '500 South Barstow Street', 'Eau Claire', 'WI', '54701', 44.8113, -91.4985, 'Divisional courthouse')
ON CONFLICT DO NOTHING;
INSERT INTO app.federal_courthouses 
  (name, short_name, courthouse_type, district, circuit, address_line1, city, state, postal_code, latitude, longitude, notes)
VALUES
  -- EIGHTH CIRCUIT (Divisional / Additional)
  ('United States Courthouse', 'District of Minnesota - St. Paul (District)', 'district_court', 'District of Minnesota', 'Eighth Circuit', '316 North Robert Street', 'St. Paul', 'MN', '55101', 44.9537, -93.0900, 'Main divisional building'),
  ('United States Courthouse', 'District of Nebraska - Lincoln (District)', 'district_court', 'District of Nebraska', 'Eighth Circuit', '100 Centennial Mall North', 'Lincoln', 'NE', '68508', 40.8136, -96.7026, 'Divisional courthouse'),

  -- NINTH CIRCUIT (Divisional / Additional)
  ('United States Courthouse', 'District of Alaska - Fairbanks (District)', 'district_court', 'District of Alaska', 'Ninth Circuit', '101 12th Avenue', 'Fairbanks', 'AK', '99701', 64.8431, -147.7231, 'Divisional courthouse'),
  ('United States Courthouse', 'District of Alaska - Juneau (District)', 'district_court', 'District of Alaska', 'Ninth Circuit', '709 West 9th Street', 'Juneau', 'AK', '99801', 58.3019, -134.4197, 'Divisional courthouse'),
  ('United States Courthouse', 'District of Arizona - Tucson (District)', 'district_court', 'District of Arizona', 'Ninth Circuit', '405 West Congress Street', 'Tucson', 'AZ', '85701', 32.2217, -110.9265, 'Divisional courthouse'),
  ('United States Courthouse', 'District of Arizona - Flagstaff (District)', 'district_court', 'District of Arizona', 'Ninth Circuit', '123 North San Francisco Street', 'Flagstaff', 'AZ', '86001', 35.1981, -111.6514, 'Divisional courthouse'),
  ('United States Courthouse', 'Central District of California - Riverside (District)', 'district_court', 'Central District of California', 'Ninth Circuit', '3470 Twelfth Street', 'Riverside', 'CA', '92501', 33.9806, -117.3755, 'Divisional courthouse'),
  ('United States Courthouse', 'Central District of California - Santa Ana (District)', 'district_court', 'Central District of California', 'Ninth Circuit', '411 West Fourth Street', 'Santa Ana', 'CA', '92701', 33.7455, -117.8677, 'Divisional courthouse'),
  ('United States Courthouse', 'Eastern District of California - Sacramento (District)', 'district_court', 'Eastern District of California', 'Ninth Circuit', '501 I Street', 'Sacramento', 'CA', '95814', 38.5816, -121.4944, 'Divisional courthouse'),
  ('United States Courthouse', 'Northern District of California - San Jose (District)', 'district_court', 'Northern District of California', 'Ninth Circuit', '280 South First Street', 'San Jose', 'CA', '95113', 37.3330, -121.8900, 'Divisional courthouse'),
  ('United States Courthouse', 'Northern District of California - Oakland', 'district_court', 'Northern District of California', 'Ninth Circuit', '1301 Clay Street', 'Oakland', 'CA', '94612', 37.8044, -122.2711, 'Divisional courthouse'),
  ('United States Courthouse', 'District of Nevada - Reno (District)', 'district_court', 'District of Nevada', 'Ninth Circuit', '400 South Virginia Street', 'Reno', 'NV', '89501', 39.5296, -119.8138, 'Divisional courthouse')
ON CONFLICT DO NOTHING;
INSERT INTO app.federal_courthouses 
  (name, short_name, courthouse_type, district, circuit, address_line1, city, state, postal_code, latitude, longitude, notes)
VALUES
  -- TENTH CIRCUIT (Divisional / Additional)
  ('United States Courthouse', 'District of Kansas - Topeka (District)', 'district_court', 'District of Kansas', 'Tenth Circuit', '444 SE Quincy Street', 'Topeka', 'KS', '66683', 39.0473, -95.6752, 'Divisional courthouse'),
  ('United States Courthouse', 'District of New Mexico - Las Cruces (District)', 'district_court', 'District of New Mexico', 'Tenth Circuit', '100 North Church Street', 'Las Cruces', 'NM', '88001', 32.3122, -106.7783, 'Divisional courthouse'),
  ('United States Courthouse', 'Western District of Oklahoma - Lawton', 'district_court', 'Western District of Oklahoma', 'Tenth Circuit', '200 SW 4th Street', 'Lawton', 'OK', '73501', 34.6036, -98.3959, 'Divisional courthouse'),

  -- ELEVENTH CIRCUIT (Divisional / Additional)
  ('United States Courthouse', 'Southern District of Florida - Fort Lauderdale (District)', 'district_court', 'Southern District of Florida', 'Eleventh Circuit', '299 East Broward Boulevard', 'Fort Lauderdale', 'FL', '33301', 26.1224, -80.1373, 'Divisional courthouse'),
  ('United States Courthouse', 'Southern District of Florida - West Palm Beach (District)', 'district_court', 'Southern District of Florida', 'Eleventh Circuit', '701 Clematis Street', 'West Palm Beach', 'FL', '33401', 26.7153, -80.0533, 'Divisional courthouse'),
  ('United States Courthouse', 'Middle District of Florida - Orlando (District)', 'district_court', 'Middle District of Florida', 'Eleventh Circuit', '401 West Central Boulevard', 'Orlando', 'FL', '32801', 28.5419, -81.3831, 'Divisional courthouse'),
  ('United States Courthouse', 'Middle District of Florida - Tampa (District)', 'district_court', 'Middle District of Florida', 'Eleventh Circuit', '801 North Florida Avenue', 'Tampa', 'FL', '33602', 27.9506, -82.4572, 'Divisional courthouse'),
  ('United States Courthouse', 'Northern District of Georgia - Gainesville (District)', 'district_court', 'Northern District of Georgia', 'Eleventh Circuit', '121 Spring Street SE', 'Gainesville', 'GA', '30501', 34.2978, -83.8242, 'Divisional courthouse'),
  ('United States Courthouse', 'Southern District of Georgia - Augusta (District)', 'district_court', 'Southern District of Georgia', 'Eleventh Circuit', '600 James Brown Boulevard', 'Augusta', 'GA', '30901', 33.4703, -81.9748, 'Divisional courthouse'),

  -- SPECIALTY COURTS (Additional)
  ('United States Bankruptcy Court', 'Bankruptcy District of Delaware - Wilmington', 'bankruptcy_court', 'District of Delaware', 'Third Circuit', '824 Market Street', 'Wilmington', 'DE', '19801', 39.7420, -75.5480, 'Delaware Bankruptcy Court'),
  ('United States Bankruptcy Court', 'Bankruptcy Southern District of New York - Manhattan', 'bankruptcy_court', 'Southern District of New York', 'Second Circuit', 'One Bowling Green', 'New York', 'NY', '10004', 40.7040, -74.0130, 'SDNY Bankruptcy Court'),
  ('United States Bankruptcy Court', 'Bankruptcy Central District of California - Los Angeles', 'bankruptcy_court', 'Central District of California', 'Ninth Circuit', '255 East Temple Street', 'Los Angeles', 'CA', '90012', 34.0500, -118.2400, 'CDCA Bankruptcy Court'),
  ('United States Bankruptcy Court', 'Bankruptcy Northern District of Illinois - Chicago', 'bankruptcy_court', 'Northern District of Illinois', 'Seventh Circuit', '219 South Dearborn Street', 'Chicago', 'IL', '60604', 41.8781, -87.6298, 'Bankruptcy division'),
  ('United States Bankruptcy Court', 'Bankruptcy Southern District of Florida - Miami', 'bankruptcy_court', 'Southern District of Florida', 'Eleventh Circuit', '301 North Miami Avenue', 'Miami', 'FL', '33128', 25.7743, -80.1937, 'Bankruptcy division')
ON CONFLICT DO NOTHING;
