# Recent Fixes Troubleshooting Guide

This document covers troubleshooting for issues that were recently resolved in ShadowCheck. Use this guide if you encounter similar problems.

## GeoSpatial Table Issues

### Problem: Incorrect Default Values

**Symptoms:**

- Signal showing as 0 dBm
- Channel showing as 0
- Frequency showing as 0 MHz
- Repeated distance values

**Root Cause:** API was using aggregated materialized view data instead of latest observation data.

**Solution Applied:**

- Modified networks API to use `latest_observation` mode by default
- Updated data transformers to handle field name mismatches
- Fixed signal/frequency/channel rendering to treat 0 as invalid

**Verification:**

```bash
curl -s "http://localhost:3001/api/networks?limit=3&location_mode=latest_observation" | jq '.networks[] | {bssid, signal, frequency, channel}'
```

## Analytics Widgets Failures

### Problem: "No data available" in Analytics

**Symptoms:**

- Temporal Activity showing "No data available"
- Radio Types Over Time showing "No data available"
- Threat Score Trends showing "No data available"
- Top WiFi Networks showing NaN

**Root Cause:** Missing API calls in frontend and incorrect data sources in backend.

**Solution Applied:**

- Added missing API calls for temporal, radio-time, and threat-trends endpoints
- Fixed backend SQL queries to use appropriate data sources
- Updated data transformers to handle null values properly

**Verification:**

```bash
curl -s "http://localhost:3001/api/analytics/temporal-activity" | jq '.data | length'
curl -s "http://localhost:3001/api/analytics/radio-type-over-time" | jq '.data | length'
curl -s "http://localhost:3001/api/analytics/threat-trends" | jq '.data | length'
```

## Distance Calculation Issues

### Problem: Incorrect Max Distance (~238m)

**Symptoms:**

- Max distance always showing around 238 meters
- Geographic distances not reflecting real-world measurements

**Root Cause:** Distance calculation using signal strength difference instead of PostGIS geographic functions.

**Solution Applied:**

- Updated distance calculation to use `ST_Distance` PostGIS function
- Fixed geographic coordinate handling in SQL queries

**Verification:**

```bash
curl -s "http://localhost:3001/api/networks?limit=3" | jq '.networks[] | {bssid, max_distance_meters}'
```

## Threat Score Sorting Issues

### Problem: Columns Not Sortable

**Symptoms:**

- rule_score, ml_score, ml_weight, ml_boost columns not responding to sort clicks
- No visual feedback when clicking column headers

**Root Cause:** Missing columns in API_SORT_MAP and backend sortable columns mapping.

**Solution Applied:**

- Added threat score columns to `client/src/constants/network.ts` API_SORT_MAP
- Updated backend sortable columns mapping in query builder

**Verification:**

```bash
curl -s "http://localhost:3001/api/networks?sort=rule_score&order=DESC&limit=3" | jq '.networks[] | {bssid, rule_score}'
```

## Encryption Filter Issues

### Problem: Encryption Filters Not Applying

**Symptoms:**

- Selecting OPEN/WPA2/WPA3 does not change results
- Filter badge appears but results remain unfiltered

**Root Cause:** Filter values updated but enable flags were not reliably set.

**Solution Applied:**

- Explicitly enable/disable the `encryptionTypes` filter on checkbox changes.

**Verification:**

```bash
curl -s "http://localhost:3001/api/v2/networks/filtered?filters=%7B%22encryptionTypes%22%3A%5B%22WPA3%22%5D%7D&enabled=%7B%22encryptionTypes%22%3Atrue%7D&limit=5"
```

## WiGLE Observations Not Rendering

### Problem: WiGLE Points Missing from Map

**Symptoms:**

- WiGLE observation points not appearing on map
- API returning empty results

**Root Cause:** Schema mismatch - code looking for 'public' schema but table in 'app' schema.

**Solution Applied:**

- Updated WiGLE observations table schema check from 'public' to 'app'
- Fixed table access permissions and queries

**Verification:**

```bash
curl -s "http://localhost:3001/api/networks/wigle-observations/batch" -X POST -H "Content-Type: application/json" -d '{"bssids":["18:0C:7A:EA:20:57"]}'
```

## Manufacturer Field Population

### Problem: Empty Manufacturer Fields

**Symptoms:**

- Manufacturer column showing null or empty values
- Device identification not working

**Root Cause:** Missing JOIN with radio_manufacturers table.

**Solution Applied:**

- Added radio_manufacturers JOIN with OUI prefix matching
- Used `SUBSTRING(UPPER(REPLACE(ne.bssid, ':', '')), 1, 6)` for manufacturer lookup

**Verification:**

```bash
curl -s "http://localhost:3001/api/networks?limit=3" | jq '.networks[] | {bssid, manufacturer}'
```

## Common Debugging Steps

### 1. Check API Responses

```bash
# Test networks endpoint
curl -s "http://localhost:3001/api/networks?limit=1" | jq '.'

# Test analytics endpoints
curl -s "http://localhost:3001/api/analytics/temporal-activity" | jq '.'
```

### 2. Verify Database Connections

```bash
cd /home/cyclonite01/ShadowCheckStatic && node -e "
require('dotenv').config();
const { pool } = require('./server/src/config/database');
pool.query('SELECT COUNT(*) FROM app.networks')
  .then(r => console.log('Networks count:', r.rows[0].count))
  .catch(e => console.error('DB Error:', e.message));
"
```

### 3. Check Server Logs

```bash
tail -f /home/cyclonite01/ShadowCheckStatic/server.log
```

### 4. Restart Services

```bash
# Stop server
pkill -f "node.*server" 2>/dev/null || true

# Rebuild frontend
cd /home/cyclonite01/ShadowCheckStatic && npm run build

# Start server
cd /home/cyclonite01/ShadowCheckStatic && npm start > server.log 2>&1 &
```

## Prevention

### Code Review Checklist

- [ ] Verify data source consistency (materialized views vs. tables)
- [ ] Check field name mappings between backend and frontend
- [ ] Validate schema references (public vs. app)
- [ ] Test geographic calculations with real coordinates
- [ ] Ensure all sortable columns are mapped in both frontend and backend

### Testing Commands

```bash
# Test data integrity
npm test -- --testNamePattern="networks API data integrity"

# Test API endpoints
curl -s "http://localhost:3001/api/networks?limit=1" | jq '.networks[0] | keys'
```

## Related Documentation

- [API Reference](API_REFERENCE.md) - Complete API documentation
- [Database Schema](DATABASE_SCHEMA_OBSERVATIONS_FINAL.md) - Database structure
- [Development Guide](DEVELOPMENT.md) - Development setup and workflows

---

**Last Updated:** 2026-01-30  
**Related Issues:** GeoSpatial data integrity, Analytics widgets, Distance calculations, Sorting functionality, WiGLE integration, Manufacturer identification
