# API 504 Timeout Audit (Filtered Networks Smoke Test)

## Scope

Investigated `/api/v2/networks/filtered` behavior for smoke-test filters that intermittently hit `HTTP 504` around 60s.

## Key Findings

1. **Requests are hard-capped at 60s by DB statement timeout.**
   - The Postgres pool is configured with `statement_timeout: 60000` in the shared DB config.
   - Any slow query path naturally fails around the same `~60s` duration shown in the smoke test.

2. **The “fast / network-only” path is not truly lightweight.**
   - `buildNetworkOnlyQueryImpl()` always computes `obs_latest_any` using:
     - `SELECT DISTINCT ON (bssid) ... FROM app.observations ... ORDER BY bssid, time DESC`
   - That CTE scans/sorts against `app.observations` on every request, even for simple filters where `api_network_explorer_mv` already has suitable fields.
   - This explains why even successful requests can still be slow (multi-second to 10s+).

3. **Problem filters are low-selectivity and use computed expressions.**
   - Filters like `OPEN`, `insecure`, and `bluetooth` are built against computed CASE expressions (`networkSecurityExpr`, `networkTypeExpr`) that depend on joined `obs_latest_any` aliases.
   - Because predicates are expression-based (not direct `ne.security = ...` / `ne.type = ...`), planner cannot cleanly leverage the materialized-view indexes for type/security filtering.
   - Combined with broad cardinality, this pushes latency into timeout territory.

4. **`has_notes=false` path uses correlated `COUNT(*)` + `UPPER(...)` comparison.**
   - `buildEngagementPredicates()` currently emits:
     - `(SELECT COUNT(*) FROM app.network_notes WHERE UPPER(bssid) = UPPER(<expr>) AND is_deleted IS NOT TRUE) = 0`
   - This is more expensive than `NOT EXISTS` and can defeat plain `(bssid)` index usage due to function wrapping.
   - That pattern is executed as a correlated subquery during filtered list/count operations, making this filter especially timeout-prone.

5. **Current MV indexes do not include `security`.**
   - `api_network_explorer_mv` indexes currently include `bssid`, `type`, `observed_at`, and `threat_score`.
   - There is no dedicated `security` index for direct security/encryption filtering; broad security buckets require heavy scans.

## Why these smoke-test cases fail while others pass

- **Pass quickly or moderately:** highly selective predicates (`ssid`, `threatScore>=50`, `BLE only`) reduce scanned rows.
- **Fail at ~60s:** broad, low-selectivity filters (`OPEN`, `insecure`, `bluetooth`, `has_notes=false`) trigger expensive plans and hit the configured DB timeout.

## Recommended Remediation Order

1. **Fix engagement predicates first (highest ROI):**
   - Replace correlated `COUNT(*) > 0 / = 0` with `EXISTS / NOT EXISTS`.
   - Avoid `UPPER(...)` on indexed columns when data is already normalized.

2. **Make network-only path actually MV-only unless needed:**
   - Avoid unconditional `obs_latest_any` CTE for simple list/count filters.
   - Filter against `ne.*` columns directly where possible.

3. **Index for common broad filters:**
   - Add index on `app.api_network_explorer_mv(security)`.
   - Consider composite indexes for frequent sort + filter combos (e.g., `(type, observed_at DESC)`, `(security, observed_at DESC)`).

4. **Operational guardrail:**
   - Keep `statement_timeout` at 60s for protection, but add query instrumentation and plan logging for filtered endpoints to detect regressions earlier.
