# Sibling Pattern Exploration - Step-by-Step

## ⚠️ Current Status — Fleet SSID Filter Fix Applied

**Commit ca765d76** (May 12, 2026) removed fleet SSID exclusion from MAC-pattern sibling detection rules.

**Key change**: Fleet SSID filters (`xfinitywifi`, `hurleyguest`, `masimo`, etc.) now apply **ONLY to SSID-based rules** (`ssid_anchor`, `ssid_exact_sequential`, `cross_oui_ssid_exact`, `same_oui_proximity`). They no longer filter MAC-pattern rules (`middle_octets_sequential`, `upper_octet_rotation`, `last_octet_sequential`, etc.).

**Expected behavior after full sibling detection re-run**:

- undertaker (`8C:61:A3:7C:BD:08`) will now correctly surface xfinitywifi (`9E:61:A3:7C:BD:09`) as a sibling via `middle_octets_sequential` rule
- All MAC-pattern pairs with fleet SSIDs will be detected based on MAC structure alone

**Next action required**: Run full sibling detection job to repopulate `app.network_sibling_pairs` with corrected logic.

---

## Goal

Understand the patterns in the 1,429 confirmed sibling relationships so we can build a tight, accurate ruleset.

**Note**: This document reflects the ruleset _after_ the fleet SSID filter fix. See section 4 below for details on how rules now handle fleet SSIDs.

## Run on EC2

Connect to EC2 via SSM, then run the exploration queries one at a time:

```bash
# Get into the shadowcheck instance via SSM
aws ssm start-session --target i-06380d0c9c99f6124 --region us-east-1

# Then inside the session, run each query:

# QUERY 1: Which SSIDs have confirmed siblings?
cat > /tmp/q1.sql << 'EOF'
SELECT
  COALESCE(n1.ssid, 'NULL') as ssid,
  COUNT(*) as sibling_relationship_count,
  COUNT(DISTINCT o.bssid1) + COUNT(DISTINCT o.bssid2) as total_unique_bssids,
  string_agg(DISTINCT substring(n1.bssid, 1, 8), ', ') as distinct_ouis
FROM app.network_sibling_overrides o
LEFT JOIN app.networks n1 ON n1.bssid = o.bssid1
WHERE o.relation = 'sibling' AND o.is_active = true
GROUP BY COALESCE(n1.ssid, 'NULL')
ORDER BY sibling_relationship_count DESC
LIMIT 50;
EOF

docker exec -it shadowcheck_postgres psql -U shadowcheck_admin -d shadowcheck_db < /tmp/q1.sql
```

The file `scripts/explore-sibling-patterns.sql` contains 6 detailed queries to run sequentially.

## What Each Query Shows

1. **QUERY 1:** SSID distribution - which SSIDs appear most in confirmed siblings
2. **QUERY 2:** MAC patterns by SSID - do siblings share first-4-octets or just OUI?
3. **QUERY 3:** Fleet SSID structure - for mdt, PAS-RIG, etc., how many units per SSID?
4. **QUERY 4:** Octet deltas - what are the actual MAC differences in confirmed siblings?
5. **QUERY 5:** Band patterns - how do 2.4 GHz vs 5 GHz siblings relate?
6. **QUERY 6:** The mdt test case - show all mdt + 3-digit confirmed siblings

## Analysis Approach

After running these queries on EC2:

1. **Identify SSID categories:**
   - Fleet SSIDs (mdt, PAS-RIG, etc.) — multiple units, each with unique MAC range
   - Single-device SSIDs (undertaker, etc.) — one device, multiple radios/bands

2. **Extract MAC constraints:**
   - For fleet SSIDs: what level of MAC must match? (first 4? 5?)
   - For single devices: what are the band-based patterns?

3. **Extract octet delta constraints:**
   - Which octets can differ, and by how much?
   - Are the patterns consistent per SSID or per manufacturer?

4. **Build ruleset v4:**
   - Tighter JOIN (first 5 octets instead of 2)
   - SSID-aware logic for fleet vs single-device patterns
   - Band-based checks for multi-radio devices

## Next Steps After Analysis

Once we understand the patterns:

- Build new `find_sibling_radios()` function with refined constraints
- Test on all 1,429 confirmed + 20 not_sibling pairs
- Measure accuracy (target: 90-95%)
- Deploy via migration
- Export as ML training data

---

## Ruleset Design — SSID-Based vs MAC-Pattern Rules

The sibling detection ruleset (as of May 2026) is split into two categories with different filtering strategies:

### SSID-Based Rules (Fleet SSID filters apply)

These rules match siblings based on SSID content. Fleet SSID filters prevent high-confidence false positives:

- **`ssid_anchor`** — Same SSID + same OUI (first 4 octets)
- **`ssid_exact_sequential`** — Identical SSIDs + sequential BSSIDs
- **`cross_oui_ssid_exact`** — Same SSID + different OUI
- **`same_oui_proximity`** — Same SSID + same OUI + geospatial proximity

**Fleet SSID exclusion rationale**: Networks like `xfinitywifi`, `hurleyguest`, `masimo` are broadcast by thousands of independent devices across wide geographic regions. Matching only on SSID creates massive false-positive clusters (e.g., thousands of independent Xfinity hotspots treated as one "family"). Fleet SSID filters prevent this.

### MAC-Pattern Rules (No fleet SSID filtering)

These rules match siblings purely on MAC address structure. SSID is irrelevant:

- **`middle_octets_sequential`** — Middle octets identical, last octet sequential
- **`upper_octet_rotation`** — OUI octets form a rotation pattern (e.g., AA:BB:CC vs CC:BB:AA)
- **`last_octet_sequential`** — Last octet is sequential (delta 1-3)
- **`octet4_rotation_64`** — Octet 4 rotates by 64
- **`cisco_quad_radio`** — Cisco quad-radio AP pattern
- **`genesee_county_wide_sequential`** — Specific geographic sequential pattern
- **`target_retail_sequential`** — Target retail chain sequential pattern
- **`rglide_wide_sequential`** — Riverglide provider sequential pattern

**No fleet SSID filtering**: MAC-pattern rules detect based on hardware structure, not advertised network names. A device with SSID `xfinitywifi` that shares MAC structure with `undertaker` or `AWIFI` is still a sibling (same physical radio with different software configurations). Fleet SSID filters would break these matches and create false negatives.

**Example**: undertaker (`8C:61:A3:7C:BD:08`) and xfinitywifi (`9E:61:A3:7C:BD:09`) match via `middle_octets_sequential` (middle octets `61:A3:7C` identical, last octet delta 1). These are different radios on the same Commscope AP. Before the fix, fleet SSID filters blocked this match. After the fix (commit ca765d76), it's correctly detected.

---

## Post-Fix Verification

After running the full sibling detection job with the corrected ruleset:

1. **Query undertaker's sibling group:**

   ```sql
   SELECT p.bssid1, p.bssid2, n2.ssid AS sibling_ssid, p.rule, p.confidence
   FROM app.network_sibling_pairs p
   LEFT JOIN app.networks n2 ON n2.bssid = p.bssid2
   WHERE p.bssid1 = '8C:61:A3:7C:BD:08'
   UNION ALL
   SELECT p.bssid2, p.bssid1, n1.ssid, p.rule, p.confidence
   FROM app.network_sibling_pairs p
   LEFT JOIN app.networks n1 ON n1.bssid = p.bssid1
   WHERE p.bssid2 = '8C:61:A3:7C:BD:08'
   ORDER BY rule, bssid2;
   ```

   **Expected**: Should now include xfinitywifi, Xfinity, and other MACs with structural similarity.

2. **Verify fleet SSID pairs from SSID-based rules are still excluded:**
   ```sql
   SELECT rule, n1.ssid, COUNT(*) AS pairs
   FROM app.network_sibling_pairs p
   JOIN app.networks n1 ON n1.bssid = p.bssid1
   WHERE n1.ssid IN ('hurleyguest','myChevrolet','masimo','xfinitywifi','MGuest')
   AND rule IN ('ssid_anchor','ssid_exact_sequential','cross_oui_ssid_exact','same_oui_proximity')
   GROUP BY rule, n1.ssid
   ORDER BY pairs DESC;
   ```
   **Expected**: Should return minimal or zero results (SSID-based rules still filter fleet SSIDs).

---

## Why Sibling Detection Is an Inference Layer

Sibling detection is not only a UI grouping feature. It is ShadowCheck’s relationship layer for reasoning about physical devices, fleet infrastructure, and vendor families from noisy radio observations.

A single BSSID often represents only one radio, SSID, band, or virtual interface. Many real devices expose several related BSSIDs across 2.4 GHz, 5 GHz, guest networks, hidden SSIDs, public hotspot SSIDs, and fleet-management SSIDs. The sibling pipeline converts those isolated radio observations into probable device-level clusters.

The current architecture separates the process into several stages:

1. `app.find_sibling_radios` produces raw candidate relationships.
2. The refresh query layer writes canonical undirected pairs into `app.network_sibling_pairs`.
3. Confidence caps and rule-specific demotions prevent generic or ambiguous patterns from becoming over-trusted.
4. `app.network_sibling_overrides` allows analysts to manually confirm or block relationships.
5. `app.network_siblings_effective` exposes the resolved graph used by APIs and the Geospatial Explorer.

### Refresh Coverage and Watermarks

Scheduled sibling refreshes run incrementally. Their seed cutoff is the `started_at` timestamp of the latest successfully completed sibling scan; pair `computed_at` values describe when individual edges were written and are not scan checkpoints. The refresh seeds BSSIDs from `app.api_network_explorer_mv` whose `last_seen` is newer than that cutoff.

An incremental refresh does not revisit older observations when detection rules change. Run a full sibling refresh after rule changes to evaluate historical networks. Networks absent from `app.api_network_explorer_mv` are outside the seed set; that materialized view requires qualifying geolocated observations.

### Key Advantages of the Sibling Inference Architecture

- **Device-level reasoning**: Multiple BSSIDs can be interpreted as one probable physical device or device family.
- **Graph-level context**: Pairwise edges can form connected sibling chains, allowing cluster summaries rather than isolated radio rows.
- **False-positive reduction**: Generic fallback patterns can exist as candidates without surfacing as trusted effective siblings.
- **Negative inference**: When a cluster strongly resembles an ordinary consumer gateway, campus AP, or known fleet device, the system can reduce the likelihood that it is exotic or surveillance-oriented equipment.
- **Better UI hydration**: Explorer searches and filters can preserve sibling context even when only one endpoint is visible.
- **Future product inference**: Stable sibling clusters provide the foundation for matching device families to vendor manuals, radio layouts, model behavior, and known deployment patterns.
