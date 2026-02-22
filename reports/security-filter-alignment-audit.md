# Security Filter Alignment Audit

**Date:** 2026-02-22
**Commit:** fix(filters): enforce security/threat filter consistency across api and explorer
**Scope:** Security taxonomy, geospatial explorer display, backend filter correctness

---

## 1. Root Causes

### 1.1 Non-canonical security labels in frontend display

`client/src/utils/wigle/security.ts` (`formatSecurity`) returned labels that did
not match the analytics color palette defined in `chartConstants.tsx`:

| Input pattern     | Before     | After (canonical) |
| ----------------- | ---------- | ----------------- |
| `[WPA2-PSK-CCMP]` | `WPA2-PSK` | `WPA2-P`          |
| `[WPA2-EAP-CCMP]` | `WPA2-EAP` | `WPA2-E`          |
| `[WPA3-SAE]`      | `WPA3-SAE` | `WPA3-P`          |
| `[WPA3-EAP]`      | `WPA3-EAP` | `WPA3-E`          |
| `[WPA-PSK]`       | `WPA-PSK`  | `WPA`             |
| `[WPA-EAP]`       | `WPA-EAP`  | `WPA`             |
| empty/null/NONE   | `'Open'`   | `OPEN`            |
| `UNKNOWN`         | `'Open'`   | `UNKNOWN`         |
| `[WPS][ESS]`      | (missed)   | `WPS`             |

Because the labels emitted by `formatSecurity` differed from the keys in
`SECURITY_TYPE_COLORS`, security badges in the explorer table fell through to
the `#64748b` gray fallback for ~50% of networks even when a color existed.

### 1.2 Missing colors in analytics palette

`SECURITY_TYPE_COLORS` lacked entries for `OWE` and `UNKNOWN`. Any network
whose resolved label was one of those got the generic slate fallback color.

### 1.3 No security badge in the geospatial explorer table

`NetworkTableRow.tsx` had no `else if (col === 'security')` branch. The
security column fell through to the generic string renderer, displaying raw
database capability strings like `[WPA2-PSK-CCMP][ESS]` in plain text with
no color coding.

### 1.4 Backend OPEN filter matched no real data

The `encryptionTypes` filter in `list.ts` had two bugs:

**Bug A — Missing `OPEN` handler.**
The frontend `EncryptionType` includes `'OPEN'` but the backend only handled
`'NONE'`. Sending `encryptionTypes=OPEN` fell through to the generic
`ILIKE '%OPEN%'` path which matches the literal string "OPEN" in the security
column — not null/empty/open networks.

**Bug B — ESS in OPEN exclusion regex.**
The NONE/OPEN predicate was:

```sql
ne.security !~* '(WPA|WEP|ESS|RSN|CCMP|TKIP|OWE|SAE)'
```

`[ESS]` (Extended Service Set) is an infrastructure-mode flag, **not** an
encryption protocol. Many open networks advertise `[ESS]` without any WPA/WEP
markers. Including `ESS` in the exclusion regex caused open networks with
`[ESS]` in their capabilities to fail the OPEN filter.

**Bug C — WPA filter duplicated and over-broad.**

```sql
-- Before (bad)
ne.security ILIKE '%WPA%' OR ne.security ILIKE '%WPA2%' OR
ne.security ILIKE '%WPA3%' OR ne.security ILIKE '%WPA%'   ← duplicate
```

This matched WPA2 and WPA3 rows for a "WPA" filter, and had a redundant clause.

### 1.5 Threat category display/filter mismatch (fixed in prior commit)

`nts.final_threat_level` (stored ETL value) was used for display while
`threatLevelExpr` (live computed) was used for filtering. Fixed in commit
`5fdc23b` (see `reports/rule-based-threat-scoring-audit.md`).

---

## 2. Fixes Applied

### 2.1 `client/src/utils/wigle/security.ts` — rewritten

- Exported `CANONICAL_SECURITY_LABELS` array (ordered most→least secure).
- Exported `CanonicalSecurity` type.
- New `normalizeSecurityLabel(raw)` function returning only canonical labels.
- `formatSecurity` now wraps `normalizeSecurityLabel`; `fallback` parameter only
  activates when the result is `UNKNOWN` (preserving backward compatibility).
- Added WPS detection, RSN/CCMP/TKIP inference, ESS-only → OPEN.
- Removed sub-canonical variants: `WPA2-PSK`, `WPA2-EAP`, `WPA3-SAE`, `WPA3-EAP`,
  `WPA-PSK`, `WPA-EAP`.

### 2.2 `client/src/components/analytics/utils/chartConstants.tsx`

Added missing color entries:

- `OWE: '#8b5cf6'` (purple — opportunistic encryption)
- `UNKNOWN: '#64748b'` (slate — neutral fallback)

### 2.3 `client/src/components/badges/SecurityBadge.tsx` — new component

Created `SecurityBadge` following the `TypeBadge`/`ThreatBadge` pattern.
Uses `SECURITY_TYPE_COLORS` for color lookup with `UNKNOWN` as the safe fallback.

### 2.4 `client/src/components/badges/index.ts`

Re-exported `SecurityBadge` from the barrel.

### 2.5 `client/src/components/geospatial/NetworkTableRow.tsx`

Added `col === 'security'` branch that renders `<SecurityBadge>` instead of
raw text. Placed before the `col === 'signal'` branch.

### 2.6 `server/src/api/routes/v1/networks/list.ts` — encryptionTypes filter

Rewrote the `encryptionTypes` filter section:

```sql
-- OPEN (and legacy NONE alias)
ne.security IS NULL OR ne.security = ''
OR ne.security !~* '(WPA|WEP|RSN|CCMP|TKIP|OWE|SAE)'
-- ESS removed from exclusion list

-- WEP
ne.security ILIKE '%WEP%'

-- WPA v1 only (excludes WPA2/WPA3)
ne.security ILIKE '%WPA%'
AND ne.security NOT ILIKE '%WPA2%'
AND ne.security NOT ILIKE '%WPA3%'
AND ne.security !~* '(RSN|SAE)'

-- WPA2 (includes RSN-tagged rows)
(ne.security ILIKE '%WPA2%' OR ne.security ~* 'RSN')
AND ne.security NOT ILIKE '%WPA3%'

-- WPA3 (includes SAE/WPA3-Personal)
ne.security ILIKE '%WPA3%' OR ne.security ~* 'SAE'

-- OWE (case-insensitive regex)
ne.security ~* 'OWE'
```

---

## 3. Evidence of Alignment

### 3.1 Test results (`tests/unit/securityFilter.test.ts`)

```
PASS tests/unit/securityFilter.test.ts
  normalizeSecurityLabel – canonical taxonomy output
    ✓ empty string → OPEN
    ✓ null → OPEN
    ✓ [WPA2-PSK-CCMP][ESS] → WPA2-P (not WPA2-PSK)
    ✓ [WPA3-SAE][ESS] → WPA3-P (not WPA3-SAE)
    ✓ [WPA3-EAP][ESS] → WPA3-E (not WPA3-EAP)
    ✓ [ESS] only (open network) → OPEN
    ✓ OWE → OWE
    ✓ every output is a canonical label
  formatSecurity – backward compatibility
    ✓ returns canonical label by default
    ✓ fallback used only when result is UNKNOWN
  OPEN filter semantics – backend predicate
    ✓ null security → matches OPEN
    ✓ [ESS] only → matches OPEN (ESS NOT in exclusion list)
    ✓ [WPA2-PSK-CCMP][ESS] → does NOT match OPEN
  SECURITY_TYPE_COLORS – palette completeness
    ✓ every canonical label has a color entry
    ✓ color values are valid hex strings
```

### 3.2 Label → Color mapping (post-fix)

| Label   | Color     | Notes                 |
| ------- | --------- | --------------------- |
| WPA3-E  | `#059669` | Enterprise, strongest |
| WPA3-P  | `#34d399` | Personal (SAE)        |
| WPA3    | `#10b981` | Unspecified WPA3 mode |
| WPA2-E  | `#2563eb` | Enterprise            |
| WPA2-P  | `#60a5fa` | Personal (PSK)        |
| WPA2    | `#3b82f6` | Unspecified WPA2 mode |
| WPA     | `#06b6d4` | WPA v1                |
| OWE     | `#8b5cf6` | Opportunistic         |
| WPS     | `#f97316` | WPS only              |
| WEP     | `#ef4444` | Deprecated/insecure   |
| OPEN    | `#f59e0b` | No encryption         |
| UNKNOWN | `#64748b` | Cannot classify       |

---

## 4. Remaining Risks

### 4.1 Database `ne.security` column content variation

The backend filter predicates assume WiGLE-style capability strings
(e.g. `[WPA2-PSK-CCMP][ESS]`). Kismet imports may produce slightly different
formats. The regex-based predicates are reasonably robust but should be
validated against a sample of the actual DB content.

### 4.2 Analytics backend security grouping

`GET /api/analytics/security` returns raw DB values grouped by `ne.security`.
If the DB stores raw capability strings, the chart will show many unique values
instead of grouped canonical labels. The analytics service should normalize
security labels server-side before grouping (Phase 2 recommendation).

### 4.3 Canonical labels in v2 filtered endpoint

`filterQueryBuilder` (used by `/api/v2/networks/filtered`) has its own security
filter logic. It was not updated in this fix. Ensure it applies the same
`OPEN_PREDICATE` and WPA/WPA2/WPA3 semantics.

### 4.4 `Mixed` EncryptionType

The `EncryptionType` union includes `'Mixed'` but it has no backend handler.
It falls through to `ILIKE '%Mixed%'` which never matches. Define semantics for
`Mixed` (e.g. networks with both WPA and WPA2 capabilities) in a future task.

---

## 5. Follow-up Recommendations

1. **Add server-side security normalization** in the analytics service so
   chart data groups by canonical label, not raw capability strings.
2. **Update v2 filterQueryBuilder** to use the same corrected OPEN predicate.
3. **Define `Mixed` semantic** for the `EncryptionType` filter.
4. **Add integration test** that queries `/api/networks?encryptionTypes=OPEN`
   against a live DB and asserts returned rows have null/empty/[ESS]-only
   security strings.
5. **Export canonical labels from a shared constants module** accessible to
   both the frontend (TypeScript) and backend (via a shared types package) to
   prevent future drift.
