# ShadowCheck Code-Documentation Alignment Audit Report

**Total files audited:** 114
**Total discrepancies found:** 8
**By severity:** CRITICAL [1], HIGH [3], MEDIUM [2], LOW [2]

## 1. DOCKER SETUP & DB_HOST (HIGH PRIORITY)

FILE: docs/CONFIG.md
├─ LINE: 141
├─ CLAIM: "DB_HOST=shadowcheck_postgres" or "DB_HOST=localhost"
├─ REALITY: `DB_HOST` defaults to 'postgres' across the new Docker compose setup and in `server/src/config/database.ts`.
├─ SEVERITY: HIGH
├─ FIX: Update `docs/CONFIG.md`, `deploy/aws/.env.example` and `docs/DEVELOPMENT.md` to reflect `postgres` as the default for Docker, and `localhost` strictly for host-based development.
└─ VERIFICATION: Check `server/src/config/database.ts` and `docker-compose.yml`.

FILE: deploy/aws/README.md
├─ LINE: 62
├─ CLAIM: Lists multiple DB_HOST alternatives without clarifying standard fallback.
├─ REALITY: Local compose uses `postgres` by default.
├─ SEVERITY: HIGH
├─ FIX: Standardize AWS docs to align with the core fallback behavior, specifying exactly when an override is necessary.
└─ VERIFICATION: Check `deploy/aws/scripts/scs_rebuild.sh` line 400.

## 2. GEOCODING DAEMON

FILE: docs/ARCHITECTURE.md
├─ LINE: N/A (Missing)
├─ CLAIM: Documentation on geocoding implies basic one-off requests.
├─ REALITY: `server/src/services/geocoding/daemonRuntime.ts` contains `runGeocodeDaemonLoop` and `startGeocodingDaemon` which provide a continuous loop for batch geocoding. This entire daemon behavior is completely undocumented in the architecture files.
├─ SEVERITY: HIGH
├─ FIX: Create a new section in `docs/ARCHITECTURE.md` detailing the Geocoding Daemon, its background loop, and cache updating mechanism.
└─ VERIFICATION: Read `server/src/services/geocoding/daemonRuntime.ts`.

FILE: docs/FEATURES.md
├─ LINE: 81
├─ CLAIM: Lists "Abstract" as a supported multi-API geocoding provider.
├─ REALITY: `server/src/services/geocoding/providers.ts` includes Mapbox, Nominatim, Overpass, OpenCage, Geocodio, and LocationIQ. "Abstract" is missing.
├─ SEVERITY: MEDIUM
├─ FIX: Remove "Abstract" from the supported providers list, or implement the Abstract provider in code.
└─ VERIFICATION: Check `server/src/services/geocoding/providers.ts` export list.

## 3. FLEET DETECTION DASHBOARDS

FILE: deploy/monitoring/README.md
├─ LINE: N/A
├─ CLAIM: No mention of specific intelligence dashboard generation.
├─ REALITY: `deploy/monitoring/grafana/provisioning/dashboards/intelligence/gen_home_fleet_detection.py` and `shadowcheck_home_fleet_detection.json` exist to dynamically build specialized fleet detection views.
├─ SEVERITY: LOW
├─ FIX: Add documentation to `deploy/monitoring/README.md` explaining the `gen_home_fleet_detection.py` script and the purpose of the Intelligence dashboards.
└─ VERIFICATION: Check `deploy/monitoring/grafana/provisioning/dashboards/intelligence/build.py`.

## 4. AWS DEPLOYMENT

FILE: deploy/aws/scripts/README.md
├─ LINE: 27
├─ CLAIM: Briefly mentions `launch-shadowcheck-arm-spot.sh` and `scs_rebuild.sh` but lacks comprehensive parameter breakdowns.
├─ REALITY: `scs_rebuild.sh` is now the canonical mechanism handling migrations, building containers, and setting up the environment, overriding older manual SQL scripts.
├─ SEVERITY: MEDIUM
├─ FIX: Deprecate manual `psql` instructions across the AWS documentation suite in favor of pointing to `scs_rebuild.sh`, and thoroughly document its flags/behaviors.
└─ VERIFICATION: Check `deploy/aws/scripts/scs_rebuild.sh` and `deploy/aws/README.md`.

FILE: deploy/aws/IMPLEMENTATION_SUMMARY.md
├─ LINE: N/A
├─ CLAIM: Does not mention the newer `launch-shadowcheck-arm-spot.sh` for spot instances.
├─ REALITY: The script `launch-shadowcheck-arm-spot.sh` is actively maintained for EC2 deployment.
├─ SEVERITY: LOW
├─ FIX: Add a section explaining the ARM Spot Instance deployment script.
└─ VERIFICATION: Look at `deploy/aws/scripts/launch-shadowcheck-arm-spot.sh`.

## 5. MODULARITY REFACTORS

FILE: docs/ARCHITECTURE.md
├─ LINE: 179
├─ CLAIM: "Modular service decomposition continues" (implies work is still pending for `backgroundJobs`).
├─ REALITY: `server/src/services/backgroundJobs/config.ts` and the `agency/courthouse` repositories have been successfully extracted and finalized.
├─ SEVERITY: CRITICAL
├─ FIX: Mark Phase 6/7 modularity as complete in `docs/ARCHITECTURE.md` and explicitly document the newly extracted service boundaries.
└─ VERIFICATION: Check `server/src/services/backgroundJobs/config.ts`.

---

## MISSING DOCUMENTATION

1. **Geocoding Daemon**: Zero documentation on the continuous daemon loop (`runGeocodeDaemonLoop`). Requires a dedicated `docs/GEOCODING_DAEMON.md` or a section in `ARCHITECTURE.md`.
2. **Fleet Intelligence Generation**: The Python scripts in `deploy/monitoring/grafana/provisioning/dashboards/intelligence/` are undocumented. Needs a `deploy/monitoring/INTELLIGENCE.md`.

## QUICK-FIX CHECKLIST

1. [ ] (15 min) Update `DB_HOST` default text in `docs/CONFIG.md`, `deploy/aws/.env.example`, and `docs/DEVELOPMENT.md`.
2. [ ] (30 min) Write `docs/GEOCODING_DAEMON.md` detailing the background cache loop.
3. [ ] (15 min) Remove "Abstract" from the geocoding provider list in `docs/FEATURES.md`.
4. [ ] (20 min) Update `deploy/aws/scripts/README.md` to fully document `scs_rebuild.sh` parameters and `launch-shadowcheck-arm-spot.sh`.
5. [ ] (10 min) Update `docs/ARCHITECTURE.md` to reflect the completed `backgroundJobs` modularity refactor.
