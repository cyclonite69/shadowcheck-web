-- Load network metadata (all devices) into staging_networks.
-- Set csv_path to each dataset CSV and run; files can be appended.
\set csv_path '/home/cyclonite01/Documents/j24_networks.csv'

\COPY staging_networks (dataset,bssid,ssid,channel,radio,first_seen_ms,first_lat,first_lon,first_loc_src,last_signal,last_lat,last_lon,vendor,security,notes,external)
  FROM :'csv_path' WITH (FORMAT csv);
