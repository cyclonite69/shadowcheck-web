# ShadowCheck Universal Filter System

The Universal Filter system provides a standardized way to query wireless network data across all explorer and analytics views. It uses an explicit **enabled/disabled** model for forensic integrity—only filters that are explicitly toggled on will be applied to the query.

## Filter Groups

### A. Identity Filters

| Key            | Type     | Description                                                                    |
| :------------- | :------- | :----------------------------------------------------------------------------- |
| `ssid`         | `string` | SSID name (partial ILIKE match). Supports `-` or `NOT` prefixes for exclusion. |
| `bssid`        | `string` | BSSID match. Supports `*` and `?` wildcards (e.g. `00:11:22:*`).               |
| `manufacturer` | `string` | Manufacturer name or OUI prefix.                                               |

### SSID Search Syntax

The `ssid` filter supports a rich search syntax for precise inclusion/exclusion matching.

**Tokenization**: Commas split the input into independent AND-ed terms (`splitTextFilterTokens`). Each comma-separated term is evaluated separately and all must match.

**Pipe OR within a term**: Within a single term, `|` separates alternatives. A positive OR-group matches if any alternative matches; a negated OR-group applies De Morgan's law (NOT A AND NOT B).

**Negation prefixes**: A term beginning with `-` or `NOT ` (case-insensitive with trailing space) inverts the match, excluding networks whose SSID (current or any historical observation SSID) contains that value.

**Wildcards**: `*` expands to `%` (any sequence) and `?` expands to `_` (any single character) via `normalizeWildcards`. Without wildcards, the term is wrapped as a substring match (`%term%`).

| Example              | Behavior                                                                                         |
| :------------------- | :----------------------------------------------------------------------------------------------- |
| `fbi`                | Matches SSIDs containing "fbi"                                                                   |
| `fbi,surveillance`   | SSID must match both "fbi" AND "surveillance"                                                    |
| `fbi\|surveillance`  | SSID matches "fbi" OR "surveillance"                                                             |
| `-fbi`               | Excludes SSIDs containing "fbi"                                                                  |
| `NOT fbi`            | Excludes SSIDs containing "fbi" (alternate prefix)                                               |
| `-fbi\|surveillance` | Excludes SSIDs matching either "fbi" OR "surveillance" (De Morgan: NOT fbi AND NOT surveillance) |
| `fbi*`               | Prefix match — SSIDs starting with "fbi"                                                         |
| `-fbi,surveillance`  | Excludes "fbi" AND SSID must also contain "surveillance"                                         |

The SSID match covers both the network's current SSID and any SSID observed historically in `app.observations` for the same BSSID.

### B. Radio / Physical Layer

| Key              | Type              | Description                                              |
| :--------------- | :---------------- | :------------------------------------------------------- |
| `radioTypes`     | `RadioType[]`     | List of radio types (`W`, `E`, `B`, `L`, `G`, `N`, `?`). |
| `frequencyBands` | `FrequencyBand[]` | RF bands (`2.4GHz`, `5GHz`, `6GHz`, `BLE`, `Cellular`).  |
| `channelMin`     | `number`          | Minimum channel number.                                  |
| `channelMax`     | `number`          | Maximum channel number.                                  |
| `rssiMin`        | `number`          | Minimum signal strength (dBm). Enforced floor: -95 dBm.  |
| `rssiMax`        | `number`          | Maximum signal strength (dBm).                           |

### C. Security Filters

| Key               | Type               | Description                                                          |
| :---------------- | :----------------- | :------------------------------------------------------------------- |
| `encryptionTypes` | `EncryptionType[]` | List of encryption protocols (e.g., `WPA2-P`, `WPA3`, `OPEN`).       |
| `securityFlags`   | `SecurityFlag[]`   | Derived labels (`insecure`, `deprecated`, `enterprise`, `personal`). |

### D. Temporal Filters

| Key             | Type              | Description                                                                                              |
| :-------------- | :---------------- | :------------------------------------------------------------------------------------------------------- |
| `timeframe`     | `TimeframeFilter` | Absolute (date range) or Relative (`24h`, `7d`, `30d`, `90d`).                                           |
| `temporalScope` | `TemporalScope`   | Domain: `observation_time` (default), `FIRST_SEEN`, `LAST_SEEN`, `NETWORK_LIFETIME`, or `threat_window`. |

### E. Observation Quality & Metadata

| Key                    | Type        | Description                                                                  |
| :--------------------- | :---------- | :--------------------------------------------------------------------------- |
| `observationCountMin`  | `number`    | Minimum number of observations recorded.                                     |
| `observationCountMax`  | `number`    | Maximum number of observations recorded.                                     |
| `has_notes`            | `boolean`   | Only networks with manual analyst notes.                                     |
| `tag_type`             | `TagType[]` | Manual tags: `threat`, `suspect`, `investigate`, `false_positive`, `ignore`. |
| `gpsAccuracyMax`       | `number`    | Maximum GPS error in meters for underlying observations.                     |
| `excludeInvalidCoords` | `boolean`   | Hide networks without valid lat/lon.                                         |

### F. Spatial & Proximity

| Key                   | Type           | Description                                                  |
| :-------------------- | :------------- | :----------------------------------------------------------- |
| `distanceFromHomeMin` | `number`       | Minimum distance from Home location (km).                    |
| `distanceFromHomeMax` | `number`       | Maximum distance from Home location (km).                    |
| `boundingBox`         | `BoundingBox`  | Spatial boundary (North, South, East, West).                 |
| `radiusFilter`        | `RadiusFilter` | Point-radius search (Latitude, Longitude, Radius in meters). |

### G. Threat & Heuristics

| Key                       | Type               | Description                                                   |
| :------------------------ | :----------------- | :------------------------------------------------------------ |
| `threatScoreMin`          | `number`           | Minimum final threat score (0-100).                           |
| `threatScoreMax`          | `number`           | Maximum final threat score (0-100).                           |
| `threatCategories`        | `ThreatCategory[]` | Severity levels: `critical`, `high`, `medium`, `low`, `none`. |
| `stationaryConfidenceMin` | `number`           | Minimum stationary confidence (0.0 to 1.0).                   |
| `stationaryConfidenceMax` | `number`           | Maximum stationary confidence (0.0 to 1.0).                   |

### H. Geocoding & Address

| Key                     | Type     | Description                                           |
| :---------------------- | :------- | :---------------------------------------------------- |
| `geocodedAddress`       | `string` | Street address (partial ILIKE match).                 |
| `geocodedCity`          | `string` | City name (prefix match).                             |
| `geocodedState`         | `string` | State/Region code (exact uppercase match).            |
| `geocodedPostalCode`    | `string` | Zip/Postal code (prefix match).                       |
| `geocodedCountry`       | `string` | Country code (exact uppercase match).                 |
| `geocodedPoiName`       | `string` | Point of Interest name (ILIKE match).                 |
| `geocodedPoiCategory`   | `string` | POI category (e.g., cafe, restaurant).                |
| `geocodedFeatureType`   | `string` | Feature class (e.g., address, place, poi).            |
| `geocodedProvider`      | `string` | Enrichment provider (e.g., mapbox, opencage).         |
| `geocodedConfidenceMin` | `number` | Minimum geocoding resolution confidence (0.0 to 1.0). |
| `geocodedConfidenceMax` | `number` | Maximum geocoding resolution confidence (0.0 to 1.0). |

### I. Forensic Activity

| Key                    | Type     | Description                                                |
| :--------------------- | :------- | :--------------------------------------------------------- |
| `uniqueDaysMin`        | `number` | Minimum unique days active.                                |
| `uniqueDaysMax`        | `number` | Maximum unique days active.                                |
| `uniqueLocationsMin`   | `number` | Minimum unique locations (100m grid clusters).             |
| `uniqueLocationsMax`   | `number` | Maximum unique locations (100m grid clusters).             |
| `maxDistanceMetersMin` | `number` | Minimum mobility breadth (meters between furthest points). |
| `maxDistanceMetersMax` | `number` | Maximum mobility breadth (meters between furthest points). |

### J. Machine Learning & Threat Scoring

| Key                 | Type       | Description                           |
| :------------------ | :--------- | :------------------------------------ |
| `ruleBasedScoreMin` | `number`   | Minimum raw rule-based score (0-100). |
| `ruleBasedScoreMax` | `number`   | Maximum raw rule-based score (0-100). |
| `mlThreatScoreMin`  | `number`   | Minimum pure ML model score (0-100).  |
| `mlThreatScoreMax`  | `number`   | Maximum pure ML model score (0-100).  |
| `mlWeightMin`       | `number`   | Minimum evidence weight.              |
| `mlWeightMax`       | `number`   | Maximum evidence weight.              |
| `mlBoostMin`        | `number`   | Minimum ML model boost applied.       |
| `mlBoostMax`        | `number`   | Maximum ML model boost applied.       |
| `modelVersion`      | `string[]` | Specific ML model version strings.    |

### K. WiGLE Persistence

| Key                              | Type     | Description                                         |
| :------------------------------- | :------- | :-------------------------------------------------- |
| `wigle_v3_observation_count_min` | `number` | Minimum WiGLE external observations.                |
| `wigle_v3_observation_count_max` | `number` | Maximum WiGLE external observations.                |
| `wigleV3LastImportBefore`        | `string` | Observations imported before date (ISO/YYYY-MM-DD). |
| `wigleV3LastImportAfter`         | `string` | Observations imported after date (ISO/YYYY-MM-DD).  |

### L. Surveillance Gear & Classification

| Key            | Type      | Description                                                       |
| :------------- | :-------- | :---------------------------------------------------------------- |
| `surveillance` | `boolean` | Gated filter to return only networks with matching detections.    |
| `shotspotter`  | `boolean` | Matches ShotSpotter sensor detections.                            |
| `bwc`          | `boolean` | Matches Body Worn Camera (BWC) detections.                        |
| `flock`        | `boolean` | Matches Flock Safety camera detections.                           |
| `deviceClass`  | `string`  | Filter by threat class type string (e.g. `'FLOCK_NEW_FIRMWARE'`). |

## Implementation Notes

1.  **Forensic Integrity**: If a filter is not enabled, its value is ignored entirely.
2.  **Performance**: Filters are applied to Materialized Views where possible, or via Rollup CTEs for aggregate calculations.
3.  **Consistency**: The same filter payload is used for REST API calls and internal store synchronization.
4.  **Radius List Pagination**: A radius-only filtered network list using the default last-seen sort applies `LIMIT` and `OFFSET` when selecting the ordered BSSID page, before per-network observation rollups; the outer query does not re-apply the page offset. Other enabled filters and sort orders retain the general rollup path. The filtered-list request uses a 50-second shared database deadline with maximum statement budgets of 40 seconds for the list, 2 seconds per sibling-supplement query, and 5 seconds for the optional count. If the count times out, the page is returned with `pagination.totalUnavailable: true` and `pagination.total: null`; a timed-out sibling supplement returns the page without sibling additions.
