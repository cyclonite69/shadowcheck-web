-- Indexes for critical-infrastructure fleet dashboards.
-- These queries group/filter by state + encryption and repeatedly extract the
-- 24-bit OUI from BSSID for radio_manufacturers joins.

CREATE INDEX IF NOT EXISTS idx_wigle_v2_country_region_encryption_lasttime
ON app.wigle_v2_networks_search (country, region, encryption, lasttime DESC)
WHERE trilat IS NOT NULL AND trilong IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_wigle_v2_bssid_oui24_expr
ON app.wigle_v2_networks_search ((LEFT(UPPER(REPLACE(bssid, ':', '')), 6)))
WHERE country = 'US';
