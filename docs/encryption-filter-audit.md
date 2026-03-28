# Encryption Filter Audit

## Canonical encryption buckets

- `OPEN`
- `WEP`
- `WPA`
- `WPA2` (includes `WPA2-E`)
- `WPA3` (includes `WPA3`, `WPA3-P`, `WPA3-OWE`, `WPA3-E`)
- `Mixed` (includes `WPA`, `WPA2*`, `WPA3*`)

## Source-of-truth relationship

- Explorer row `security` is now derived from computed capabilities, not raw text.
- Fallback order:

1. Latest observation capabilities (`observations.radio_capabilities`)
2. Explorer MV capabilities (`api_network_explorer_mv.capabilities`)
3. Explorer MV legacy security text (`api_network_explorer_mv.security`)

This keeps `encryptionTypes` filtering and `security` sorting aligned to the same normalization logic.

## Validation SQL (DB audit)

```sql
-- 1) See how many rows differ between raw security text and computed security bucket.
SELECT
  COUNT(*) AS total,
  COUNT(*) FILTER (
    WHERE COALESCE(ne.security, '') <>
      CASE
        WHEN COALESCE(ne.capabilities, ne.security, '') = '' THEN 'OPEN'
        WHEN UPPER(COALESCE(ne.capabilities, ne.security, '')) LIKE '%WEP%' THEN 'WEP'
        WHEN UPPER(COALESCE(ne.capabilities, ne.security, '')) ~ '^\\s*\\[ESS\\]\\s*$' THEN 'OPEN'
        WHEN UPPER(COALESCE(ne.capabilities, ne.security, '')) ~ '^\\s*\\[IBSS\\]\\s*$' THEN 'OPEN'
        WHEN UPPER(COALESCE(ne.capabilities, ne.security, '')) ~ 'RSN-OWE' THEN 'WPA3-OWE'
        WHEN UPPER(COALESCE(ne.capabilities, ne.security, '')) ~ 'RSN-SAE' THEN 'WPA3-P'
        WHEN UPPER(COALESCE(ne.capabilities, ne.security, '')) ~ '(WPA3|SAE)' AND UPPER(COALESCE(ne.capabilities, ne.security, '')) ~ '(EAP|MGT)' THEN 'WPA3-E'
        WHEN UPPER(COALESCE(ne.capabilities, ne.security, '')) ~ '(WPA3|SAE)' THEN 'WPA3'
        WHEN UPPER(COALESCE(ne.capabilities, ne.security, '')) ~ '(WPA2|RSN)' AND UPPER(COALESCE(ne.capabilities, ne.security, '')) ~ '(EAP|MGT)' THEN 'WPA2-E'
        WHEN UPPER(COALESCE(ne.capabilities, ne.security, '')) ~ '(WPA2|RSN)' THEN 'WPA2'
        WHEN UPPER(COALESCE(ne.capabilities, ne.security, '')) ~ 'WPA-' AND UPPER(COALESCE(ne.capabilities, ne.security, '')) NOT LIKE '%WPA2%' THEN 'WPA'
        WHEN UPPER(COALESCE(ne.capabilities, ne.security, '')) LIKE '%WPA%' AND UPPER(COALESCE(ne.capabilities, ne.security, '')) NOT LIKE '%WPA2%' AND UPPER(COALESCE(ne.capabilities, ne.security, '')) NOT LIKE '%WPA3%' AND UPPER(COALESCE(ne.capabilities, ne.security, '')) NOT LIKE '%RSN%' THEN 'WPA'
        WHEN UPPER(COALESCE(ne.capabilities, ne.security, '')) LIKE '%WPS%' AND UPPER(COALESCE(ne.capabilities, ne.security, '')) NOT LIKE '%WPA%' AND UPPER(COALESCE(ne.capabilities, ne.security, '')) NOT LIKE '%RSN%' THEN 'WPS'
        WHEN UPPER(COALESCE(ne.capabilities, ne.security, '')) ~ '(CCMP|TKIP|AES)' THEN 'WPA2'
        ELSE 'UNKNOWN'
      END
  ) AS differs_from_computed
FROM app.api_network_explorer_mv ne;
```

```sql
-- 2) Relationship between explorer type + computed security buckets.
WITH norm AS (
  SELECT
    ne.type,
    CASE
      WHEN COALESCE(ne.capabilities, ne.security, '') = '' THEN 'OPEN'
      WHEN UPPER(COALESCE(ne.capabilities, ne.security, '')) LIKE '%WEP%' THEN 'WEP'
      WHEN UPPER(COALESCE(ne.capabilities, ne.security, '')) ~ '(WPA2|RSN)' THEN 'WPA2'
      WHEN UPPER(COALESCE(ne.capabilities, ne.security, '')) ~ '(WPA3|SAE)' THEN 'WPA3'
      WHEN UPPER(COALESCE(ne.capabilities, ne.security, '')) LIKE '%WPA%' THEN 'WPA'
      ELSE 'UNKNOWN'
    END AS security_bucket
  FROM app.api_network_explorer_mv ne
)
SELECT type, security_bucket, COUNT(*) AS count
FROM norm
GROUP BY type, security_bucket
ORDER BY type, count DESC;
```

```sql
-- 3) Spot-check latest-observation override behavior for a single BSSID.
WITH latest_obs AS (
  SELECT DISTINCT ON (bssid)
    bssid,
    radio_capabilities,
    time
  FROM app.observations
  WHERE bssid = 'AA:BB:CC:DD:EE:FF'
  ORDER BY bssid, time DESC
)
SELECT
  ne.bssid,
  ne.type,
  ne.security AS mv_security_raw,
  ne.capabilities AS mv_capabilities,
  lo.radio_capabilities AS latest_obs_capabilities,
  lo.time AS latest_obs_time
FROM app.api_network_explorer_mv ne
LEFT JOIN latest_obs lo ON UPPER(lo.bssid) = UPPER(ne.bssid)
WHERE UPPER(ne.bssid) = UPPER('AA:BB:CC:DD:EE:FF');
```
