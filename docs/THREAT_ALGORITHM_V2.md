# Threat Scoring Algorithm V2

## Overview

Improved threat detection algorithm with reduced false positive rate based on analysis of tagged networks.

## Changes from V1

### Scoring Adjustments

**V1 Algorithm (30pt threshold):**

- 40pts: Seen at home AND away
- 25pts: Distance range > 0.2km
- 15pts: 7+ unique days
- 10pts: 50+ observations

**V2 Algorithm (40pt threshold):**

- 50pts: Seen at home AND away >1km (true tracking)
- 30pts: Seen at home AND away <1km (possible neighbor)
- 30pts: Distance range >1km
- 20pts: Distance range >0.5km
- 20pts: 10+ unique days
- 15pts: 5-9 unique days
- 10pts: 3-4 unique days
- 15pts: 100+ observations
- 10pts: 50-99 observations
- 5pts: 20-49 observations

### New Penalties (Reduce False Positives)

- **-20pts**: WiFi with signal >-50 dBm (likely neighbor's strong signal)
- **-15pts**: ≤3 unique locations over 5+ days (fixed work/home pattern)

### Key Improvements

1. **Distance Threshold**: Increased from 0.2km to 1.0km
   - Eliminates most neighbor WiFi false positives
   - Focuses on true mobile tracking patterns

2. **Signal Strength Penalty**:
   - Strong WiFi signals (>-50 dBm) are typically neighbors
   - Reduces false positives from nearby networks

3. **Location Pattern Analysis**:
   - Networks seen at only 2-3 fixed locations over many days are likely work/home
   - Penalty reduces false positives from routine patterns

4. **Higher Threshold**: 40pts minimum (up from 30pts)
   - More conservative detection
   - Requires stronger evidence of tracking

## Expected Results

- **Reduced False Positives**: Target <30% (down from 61%)
- **Maintained True Positives**: Real tracking devices still score 70-100pts
- **Better Precision**: More actionable threat list

## Monitoring

Use tagged networks to validate:

```sql
SELECT
  tag_type,
  COUNT(*) as count,
  AVG(calculated_threat_score) as avg_score
FROM network_tags
GROUP BY tag_type;
```

## Future Improvements

- Time-of-day pattern analysis (9-5 work schedule detection)
- Speed calculation between observations (impossible speeds = false positive)
- SSID pattern matching (common work/public network names)
- Machine learning model trained on tagged data
