# API Gate Matrix (User vs Admin)

**Date:** 2026-03-06  
**Assumption:** `API_GATE_ENABLED=true`  
**Intent:** `search/read = user`, `insert/update/delete + admin page/system ops = admin`.

---

## Effective Mount-Level Gates

| Mount                                          | Gate                                                        |
| ---------------------------------------------- | ----------------------------------------------------------- |
| `/api` + `authRoutes`                          | public (login path)                                         |
| `/api` + `networksRoutes`                      | user                                                        |
| `/api` + `threatsRoutes`                       | user                                                        |
| `/api` + `wigleRoutes`                         | user                                                        |
| `/api` + `explorerRoutes`                      | user                                                        |
| `/api/analytics` + `analyticsRoutes`           | user                                                        |
| `/api` + `dashboardRoutes`                     | user                                                        |
| `/api/v2/networks/filtered` + `filteredRoutes` | user                                                        |
| `/api` + `networksV2Routes`                    | user                                                        |
| `/api/v2` + `threatsV2Routes`                  | user                                                        |
| `/api` + `locationMarkersRoutes`               | user                                                        |
| `/api` + `homeLocationRoutes`                  | user                                                        |
| `/api` + `keplerRoutes`                        | user                                                        |
| `/api/network-tags` + `networkTagsRoutes`      | user (write endpoints further require admin in route files) |
| `/api/networks` + `networkAgenciesRoutes`      | user                                                        |
| `/api` + `claudeRoutes`                        | user                                                        |
| `/api` + `threatReportRoutes`                  | user                                                        |
| `/api` + `mlRoutes`                            | admin                                                       |
| `/api` + `backupRoutes`                        | admin                                                       |
| `/api` + `settingsRoutes`                      | admin                                                       |
| `/api` + `adminRoutes`                         | admin                                                       |

---

## Route-Level Overrides Already Present

- `network-tags/manageTags.ts`: write operations already `requireAdmin`.
- `networks/notes.ts`: write operations already `requireAdmin`.
- `wigle/search.ts` and `wigle/detail.ts` import actions already `requireAdmin`.
- `auth.ts`: `POST /auth/create-user` is `requireAdmin`.

---

## Public/Non-API (Outside Gate)

- `/health`
- `/analytics-public/*`
- `/agency-offices/*`
- geospatial token/tile helpers mounted at `/` from `geospatialRoutes`

These are intentionally outside the `/api` gate path and should be evaluated separately if they must be protected.

---

## Policy Fit vs Requested Model

### Matches requested model

- Most read/search/list/filter endpoints are now user-gated.
- Admin page/system routes are admin-gated.
- Most write/tag/investigate/import actions are admin-only.

### Gaps / Follow-up items

1. `settingsRoutes` is fully admin-gated at mount level; if any settings endpoints should be user-readable, split route groups.
2. Export routes are currently user-gated at mount, but route file has a local no-op `requireAuth`; keep mount gate authoritative or replace no-op with real middleware for clarity.
3. Non-API public routes (`/analytics-public`, `/agency-offices`, map token/tile helpers) need explicit decision: public by design vs gated.
4. Consider route tests that assert expected 401/403 behavior per endpoint class.

---

## Recommended Next Hardening Step

Create a small authz test matrix (integration smoke) for:

- unauthenticated -> read endpoints => `401`
- authenticated user -> read endpoints => `200`
- authenticated user -> admin write endpoints => `403`
- authenticated admin -> admin write endpoints => `200`
