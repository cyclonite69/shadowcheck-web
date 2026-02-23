# Frontend–Backend Filter Alignment Audit

Scope: `FilterPanel` frontend controls and `UniversalFilterQueryBuilder` backend predicates.

Legend:

- **KEEP** = core, unique, functional
- **MERGE** = duplicate semantics; keep canonical filter only
- **REMOVE** = non-functional or unsupported

## Canonical minimal filter model (recommended)

1. Identity: `ssid`, `bssid`, `manufacturer`
2. Radio: `radioTypes`, `frequencyBands`, `channelMin`, `channelMax`, `rssiMin`, `rssiMax`
3. Security: `encryptionTypes`, `securityFlags`
4. Time: `timeframe`, `temporalScope`
5. Engagement: `has_notes`, `tag_type`
6. Quality: `observationCountMin`, `observationCountMax`, `gpsAccuracyMax`, `excludeInvalidCoords`, `qualityFilter`
7. Spatial: `boundingBox`, `radiusFilter`, `distanceFromHomeMin`, `distanceFromHomeMax`
8. Threat: `threatScoreMin`, `threatScoreMax`, `stationaryConfidenceMin`, `stationaryConfidenceMax`
9. WiGLE page only: `wigle_v3_observation_count_min`

## Per-filter decisions

| Filter                           | Status | Canonical meaning                       | Backend predicate (current)                                  | Materialized view / table                         | Required index                                                       | Notes                                                   |
| -------------------------------- | ------ | --------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------- |
| `ssid`                           | KEEP   | Name contains text                      | `o.ssid ILIKE '%...%'` / `ne.ssid ILIKE '%...%'`             | `app.observations`, `app.api_network_explorer_mv` | trigram on `ssid`                                                    | Functional; row-count impact expected.                  |
| `bssid`                          | KEEP   | BSSID exact or prefix                   | `o.bssid = ... OR LIKE 'prefix%'` / `UPPER(ne.bssid) =/LIKE` | observations + MV                                 | btree on `bssid` (exists)                                            | Functional; high selectivity.                           |
| `manufacturer`                   | KEEP   | OUI/manufacturer match                  | `rm.oui = ...` or manufacturer `ILIKE`                       | `app.radio_manufacturers`, join via bssid         | btree on `rm.oui`; trigram on manufacturer name                      | Functional; join-heavy path.                            |
| `networkId`                      | REMOVE | Internal network identifier             | **Ignored** (`unsupported_backend`)                          | none                                              | none                                                                 | Explicitly non-functional in backend.                   |
| `radioTypes`                     | KEEP   | Which radio family?                     | `typeExpr = ANY(...)`                                        | observations/MV computed type                     | btree on `radio_type` + MV `type`                                    | Functional.                                             |
| `frequencyBands`                 | KEEP   | Which RF band?                          | frequency range OR clauses                                   | observations/MV frequency                         | btree on `radio_frequency`/`frequency`                               | Functional.                                             |
| `channelMin`                     | KEEP   | Lowest channel threshold                | computed channel `>=`                                        | observations/MV frequency-derived                 | expression index on computed channel                                 | Functional; expression-based.                           |
| `channelMax`                     | KEEP   | Highest channel threshold               | computed channel `<=`                                        | observations/MV frequency-derived                 | expression index on computed channel                                 | Functional; expression-based.                           |
| `rssiMin`                        | KEEP   | Minimum signal strength                 | `level >= ...` / `signal >= ...`                             | observations/MV                                   | btree on `level`/`signal`                                            | Functional.                                             |
| `rssiMax`                        | KEEP   | Maximum signal strength                 | `level <= ...` / `signal <= ...`                             | observations/MV                                   | btree on `level`/`signal`                                            | Functional.                                             |
| `encryptionTypes`                | KEEP   | Security protocol class                 | `SECURITY_EXPR(...) IN/...`                                  | derived from capabilities                         | expression index on computed security                                | Canonical security filter.                              |
| `authMethods`                    | REMOVE | Authentication family (PSK/EAP/SAE/OWE) | mapped back to `SECURITY_EXPR` buckets                       | derived expression                                | expression index (same as encryption)                                | Removed as redundant with canonical security filters.   |
| `insecureFlags`                  | REMOVE | Is network insecure/deprecated?         | mapped to OPEN/WEP/WPS predicates                            | derived expression                                | expression index (same as encryption)                                | Removed as duplicate insecurity semantics.              |
| `securityFlags`                  | KEEP   | Derived security labels                 | mapped to same security expression buckets                   | derived expression                                | expression index (same as encryption)                                | Canonical alongside `encryptionTypes`.                  |
| `timeframe`                      | KEEP   | Which time window?                      | absolute/relative predicates over `o.time`/`ap.last_seen_at` | observations + networks                           | btree/brin on `time`, `bssid,time`                                   | Functional, but only subset of windows supported.       |
| `temporalScope`                  | KEEP   | Which timestamp domain?                 | changes `timeframe` target column                            | observations/networks                             | same as timeframe                                                    | Separate, explicit control.                             |
| `observationCountMin`            | KEEP   | Minimum observation support             | `ne.observations >= ...` or `r.observation_count >= ...`     | MV + rollup CTE                                   | btree on MV `observations`                                           | Functional.                                             |
| `observationCountMax`            | KEEP   | Maximum observation support             | `ne.observations <= ...` or `r.observation_count <= ...`     | MV + rollup CTE                                   | btree on MV `observations`                                           | Functional.                                             |
| `has_notes`                      | KEEP   | Has analyst notes?                      | `EXISTS/COUNT app.network_notes`                             | `app.network_notes`                               | partial index on `network_notes(bssid) WHERE is_deleted IS NOT TRUE` | Functional.                                             |
| `tag_type`                       | KEEP   | Has specific analyst tag(s)             | `EXISTS app.network_tags ...` + ignore mapping               | `app.network_tags`                                | btree on `bssid`; expression idx on lower(tag)                       | Functional.                                             |
| `wigle_v3_observation_count_min` | KEEP   | Minimum WiGLE corroboration             | `ne.wigle_v3_observation_count >= ...`                       | MV                                                | btree on MV wigle count                                              | Functional only on WiGLE page; ignored elsewhere.       |
| `gpsAccuracyMax`                 | KEEP   | Max acceptable GPS error                | `accuracy <= ...`                                            | observations/MV accuracy                          | btree on `accuracy` / MV `accuracy_meters`                           | Functional.                                             |
| `excludeInvalidCoords`           | KEEP   | Exclude invalid/missing coordinates     | obs + MV path checks null + range                            | observations/MV                                   | partial indexes on `(lat,lon)` not null                              | Semantics aligned across paths.                         |
| `qualityFilter`                  | KEEP   | Apply anomaly heuristics preset         | injected `DATA_QUALITY_FILTERS.*` SQL fragment               | observations                                      | depends on sub-fragment columns                                      | Functional; composite macro filter.                     |
| `distanceFromHomeMin`            | KEEP   | Minimum distance from home              | `ST_Distance(...) >=` or `ne.distance_from_home_km >=`       | obs geom + MV distance                            | gist on `geom`; btree on MV distance                                 | Functional; unit consistency must remain km end-to-end. |
| `distanceFromHomeMax`            | KEEP   | Maximum distance from home              | `ST_Distance(...) <=` or `ne.distance_from_home_km <=`       | obs geom + MV distance                            | gist on `geom`; btree on MV distance                                 | Functional.                                             |
| `boundingBox`                    | KEEP   | Inside current map bounds               | lat/lon range clauses                                        | observations                                      | composite btree `(lat,lon)` and/or gist `geom`                       | Functional; should alter spatial distribution.          |
| `radiusFilter`                   | KEEP   | Within radius of point                  | `ST_DWithin(...)`                                            | observations geom                                 | gist on `geom`                                                       | Functional; strong spatial effect expected.             |
| `threatScoreMin`                 | KEEP   | Minimum threat score                    | predicate on `get_threat_score(...)` or `ne.threat_score`    | threat_scores + tags + MV                         | btree on MV `threat_score`                                           | Functional.                                             |
| `threatScoreMax`                 | KEEP   | Maximum threat score                    | predicate on `get_threat_score(...)` or `ne.threat_score`    | threat_scores + tags + MV                         | btree on MV `threat_score`                                           | Functional.                                             |
| `threatCategories`               | MERGE  | Severity bucket selection               | `threat_level = ANY(...)` (derived from score/tag)           | MV/derived threat level expr                      | btree on MV `threat_level` or expr index                             | Redundant with score min/max in minimal model.          |
| `stationaryConfidenceMin`        | KEEP   | Minimum stationarity confidence         | `s.stationary_confidence >= ...`                             | rollup CTE (`obs_spatial`)                        | expression/materialized index if persisted                           | Functional in non-network-only path only.               |
| `stationaryConfidenceMax`        | KEEP   | Maximum stationarity confidence         | `s.stationary_confidence <= ...`                             | rollup CTE (`obs_spatial`)                        | expression/materialized index if persisted                           | Functional in non-network-only path only.               |

## Stop condition check

- Minimal set identified above.
- Remaining filters each map to a concrete predicate.
- Filters marked REMOVE/MERGE are redundant or non-functional under current implementation.
