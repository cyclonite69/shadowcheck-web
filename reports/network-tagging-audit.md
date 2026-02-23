# Network Tagging, Notes & Context System — Comprehensive Audit

**Date**: 2026-02-22
**Scope**: Database schema · API endpoints · UI components · Filter system · Explorer columns
**Status**: Audit complete — roadmap ready for implementation

---

## Table of Contents

1. [Database Schema](#1-database-schema)
2. [API Endpoints](#2-api-endpoints)
3. [UI Components](#3-ui-components)
4. [Filter System](#4-filter-system)
5. [Network Explorer Columns](#5-network-explorer-columns)
6. [Current Behavior Bugs & Issues](#6-current-behavior-bugs--issues)
7. [Missing Data in Database](#7-missing-data-in-database)
8. [Missing API Endpoints](#8-missing-api-endpoints)
9. [Missing UI Components](#9-missing-ui-components)
10. [Missing Filter Options](#10-missing-filter-options)
11. [Missing Explorer Columns](#11-missing-explorer-columns)
12. [Implementation Roadmap](#12-implementation-roadmap)

---

## 1. Database Schema

### 1.1 `app.network_tags`

**File**: `sql/migrations/20260216_consolidated_004_network_analysis.sql` lines 11–58

```sql
CREATE TABLE IF NOT EXISTS app.network_tags (
    id               integer NOT NULL,                             -- PK (serial)
    bssid            character varying(17) NOT NULL,              -- UNIQUE (one row per network)
    is_ignored       boolean DEFAULT false,
    ignore_reason    character varying(50),                        -- own_device, known_friend, neighbor, business, infrastructure, other
    threat_tag       character varying(20),                        -- THREAT | SUSPECT | FALSE_POSITIVE | INVESTIGATE
    threat_confidence numeric(3,2),                               -- 0.00–1.00, nullable
    notes            text,                                         -- short free-form text (legacy single-field)
    wigle_lookup_requested boolean DEFAULT false,
    wigle_lookup_at  timestamp with time zone,
    wigle_result     jsonb,
    created_at       timestamp with time zone DEFAULT now(),
    updated_at       timestamp with time zone DEFAULT now(),
    created_by       character varying(100) DEFAULT 'user',
    tag_history      jsonb DEFAULT '[]'::jsonb,
    tags             jsonb DEFAULT '[]'::jsonb,                   -- array-based tag store (legacy)
    detailed_notes   jsonb DEFAULT '[]'::jsonb,                   -- jsonb note array (unused in UI)
    CONSTRAINT network_tags_threat_confidence_check CHECK (...)
);
```

**Constraints**: `UNIQUE (bssid)` — one row per BSSID
**Indexes**: bssid btree, threat_tag partial, is_ignored partial, wigle_pending partial, tags GIN

**What's present**: `created_at`, `updated_at`, `created_by` ✅ — timestamps and attribution exist
**What's absent**: No `wigle_v3_observation_count`, no `wigle_v3_last_import_at` ❌

---

### 1.2 `app.network_notes`

**File**: `sql/migrations/20260216_consolidated_004_network_analysis.sql` lines 125–150

```sql
CREATE TABLE IF NOT EXISTS app.network_notes (
    id          integer NOT NULL,                     -- PK (serial)
    bssid       character varying(17) NOT NULL,       -- FK → networks (no explicit FK constraint defined)
    user_id     character varying(50) DEFAULT 'default_user',
    content     text NOT NULL,
    note_type   character varying(20) DEFAULT 'general',   -- general | threat | location | device_info
    created_at  timestamp without time zone DEFAULT now(),  -- ⚠ no timezone (inconsistent with network_tags)
    updated_at  timestamp without time zone DEFAULT now()
);
```

**Indexes**: bssid btree, created_at DESC btree, user_id btree
**Note type values**: `general`, `threat`, `location`, `device_info`
**Issue**: `created_at` uses `timestamp without time zone` — inconsistent with `network_tags.created_at` which uses `with time zone`. ❌

---

### 1.3 `app.networks`

**File**: `sql/migrations/20260216_consolidated_002_core_tables.sql` lines 37–73

Relevant columns for this audit:

```sql
threat_score_v2     numeric(5,1),
threat_factors      jsonb,
threat_level        character varying(20),
threat_updated_at   timestamp with time zone,
ml_threat_score     integer DEFAULT 0,
```

**Absent columns**: No `wigle_v3_observation_count integer`, no `wigle_v3_last_import_at timestamp` ❌
There is no fast path to "how many WiGLE observations has this BSSID ever had" without a subquery against `app.wigle_v3_observations`.

---

### 1.4 `app.wigle_v3_observations`

**File**: `sql/migrations/20260216_consolidated_006_wigle_integration.sql` lines 122–163

```sql
CREATE TABLE IF NOT EXISTS app.wigle_v3_observations (
    id           integer NOT NULL,
    netid        text NOT NULL,           -- FK → wigle_v3_network_details(netid) ON DELETE CASCADE
    latitude     double precision NOT NULL,
    longitude    double precision NOT NULL,
    altitude     double precision,
    accuracy     double precision,
    signal       integer,
    observed_at  timestamp with time zone,
    last_update  timestamp with time zone,
    ssid         text,
    frequency    integer,
    channel      integer,
    encryption   text,
    noise        integer,
    snr          integer,
    month        text,
    location     public.geometry(Point,4326),
    imported_at  timestamp with time zone DEFAULT now()
);
UNIQUE (netid, latitude, longitude, observed_at)
```

Each row is one WiGLE crowd-sourced observation. Count per `netid` = WiGLE observation count.
`imported_at` = when we last ingested this record (not the same as "last import timestamp for this BSSID").

---

### 1.5 Views

| View                             | Description                                               | Tags included?                    |
| -------------------------------- | --------------------------------------------------------- | --------------------------------- |
| `app.network_entries`            | Maps networks → API names                                 | No                                |
| `app.api_network_explorer`       | JOINs networks + network_tags + note_count subquery       | Yes — `t.updated_at AS tagged_at` |
| `app.network_summary_with_notes` | Returns latest note per network via LATERAL               | Yes — `nn.content, nn.created_at` |
| `app.network_tags_expanded`      | Full tag view with computed booleans                      | Yes                               |
| `app.network_tags_full`          | Expanded + media counts                                   | Yes                               |
| `app.api_network_explorer_mv`    | Materialized view — JOINs networks + tags + threat scores | Partial — threat_tag from tags    |

---

## 2. API Endpoints

### 2.1 Network Tags — `/api/network-tags/`

**File**: `server/src/api/routes/v1/network-tags/`

| Method   | Path                                   | Auth   | Purpose                                 | Returns                                                                                           |
| -------- | -------------------------------------- | ------ | --------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `GET`    | `/api/network-tags/:bssid`             | public | Fetch single BSSID's tags               | `{ bssid, is_ignored, ignore_reason, threat_tag, threat_confidence, notes, exists }`              |
| `GET`    | `/api/network-tags`                    | public | List all tagged networks                | `{ tags: [], total, limit, offset }` — supports `?ignored=&threat_tag=&has_notes=&pending_wigle=` |
| `POST`   | `/api/network-tags/:bssid`             | admin  | Upsert full tag record                  | `{ ok, tag }`                                                                                     |
| `PATCH`  | `/api/network-tags/:bssid/ignore`      | admin  | Toggle is_ignored                       | `{ ok, tag }`                                                                                     |
| `PATCH`  | `/api/network-tags/:bssid/threat`      | admin  | Set threat classification               | `{ ok, tag }` — `threat_tag` null to clear                                                        |
| `PATCH`  | `/api/network-tags/:bssid/notes`       | admin  | Update short notes field                | `{ ok, tag }`                                                                                     |
| `PATCH`  | `/api/network-tags/:bssid/investigate` | admin  | Mark for WiGLE lookup + set INVESTIGATE | `{ ok, tag }`                                                                                     |
| `DELETE` | `/api/network-tags/:bssid`             | admin  | Remove all tags                         | `{ ok, deleted }`                                                                                 |
| `GET`    | `/api/network-tags/export/ml`          | admin  | Export training data                    | `{ training_data, count }`                                                                        |

**Valid `threat_tag` values** (manageTags.ts): `THREAT`, `SUSPECT`, `FALSE_POSITIVE`, `INVESTIGATE`
**Valid `ignore_reason` values**: `own_device`, `known_friend`, `neighbor`, `business`, `infrastructure`, `other`

---

### 2.2 Alternative Tag Routes — `/api/networks/`

**File**: `server/src/api/routes/v1/networks/tags.ts`

| Method   | Path                               | Auth   | Purpose                                                               |
| -------- | ---------------------------------- | ------ | --------------------------------------------------------------------- |
| `GET`    | `/api/networks/tagged`             | public | List by tag type (`LEGIT`, `FALSE_POSITIVE`, `INVESTIGATE`, `THREAT`) |
| `POST`   | `/api/networks/tag-network`        | admin  | Tag single network (old endpoint)                                     |
| `DELETE` | `/api/networks/tag-network/:bssid` | admin  | Remove tag (old endpoint)                                             |
| `POST`   | `/api/networks/tag-threats`        | admin  | Bulk-tag up to 10,000 BSSIDs                                          |

⚠ **Tag value inconsistency**: `tags.ts` uses `LEGIT` and `THREAT` but not `SUSPECT`; `manageTags.ts` uses `SUSPECT` and not `LEGIT`. Two parallel systems with different vocabularies. ❌

---

### 2.3 Network Notes — Server-side service

**File**: `server/src/services/adminDbService.ts`

The notes API is not a standalone route — notes are created via context menu which calls `adminDbService` functions:

| Function                                                       | Action                                          | Table         |
| -------------------------------------------------------------- | ----------------------------------------------- | ------------- |
| `addNetworkNoteWithFunction(bssid, content, noteType, userId)` | INSERT into `app.network_notes`                 | network_notes |
| `getNetworkNotes(bssid)`                                       | SELECT from `app.network_notes`                 | network_notes |
| `deleteNetworkNote(noteId)`                                    | DELETE from `app.network_notes`                 | network_notes |
| `addNetworkNotation(bssid, text, type)`                        | UPDATE `app.network_tags.detailed_notes` jsonb  | network_tags  |
| `getNetworkNotations(bssid)`                                   | SELECT `detailed_notes` from `app.network_tags` | network_tags  |
| `addNoteMedia(noteId, bssid, ...)`                             | INSERT into `app.note_media`                    | note_media    |

There is no public HTTP endpoint for notes (e.g., `GET /api/networks/:bssid/notes`) — the frontend hooks call adminDbService indirectly. ❌

---

### 2.4 WiGLE Integration — `/api/wigle/`

**File**: `server/src/api/routes/v1/wigle/detail.ts`

| Method | Path                          | Auth  | Purpose                                                                           |
| ------ | ----------------------------- | ----- | --------------------------------------------------------------------------------- |
| `POST` | `/api/wigle/detail/:netid`    | admin | Fetch WiGLE v3 WiFi detail; optionally import observations (`body.import = true`) |
| `POST` | `/api/wigle/detail/bt/:netid` | admin | Fetch WiGLE v3 Bluetooth detail                                                   |
| `POST` | `/api/wigle/import/v3`        | admin | Import WiGLE v3 JSON file                                                         |

Response includes `importedObservations` and `totalObservations` counts, but these are not persisted back to `app.networks`. After import, the only way to know how many observations were imported is to query `app.wigle_v3_observations WHERE netid = $1`.

---

### 2.5 Main Network List — `/api/networks`

**File**: `server/src/api/routes/v1/networks/list.ts` (785 lines)

The main list endpoint **JOINs** `app.network_tags` (`LEFT JOIN app.network_tags nt ON ne.bssid = nt.bssid`, line ~562) but **does not SELECT any columns from the join** — no `threat_tag`, no `is_ignored`, no `notes` in the response. Tag data is silently ignored. ❌

---

## 3. UI Components

### 3.1 Right-Click Context Menu

**File**: `client/src/components/NetworkContextMenu.tsx` (400 lines)

**Current menu options**: Only 3:

1. **Add Note** — opens `NetworkNoteModal`
2. **Attach Media** — file attachment flow
3. **Close**

**What's MISSING from context menu** ❌:

- No "Mark as Threat" option
- No "Mark as False Positive" option
- No "Mark as Investigate" option
- No "Ignore Network" option
- No "View all tags" option
- No "Request WiGLE import" shortcut
- No display of existing tags for the right-clicked network

The PATCH threat/ignore/investigate endpoints exist in the API but are **not accessible from the context menu**. Users cannot classify networks via right-click. This is the primary UX gap.

---

### 3.2 Network Note Modal

**File**: `client/src/components/geospatial/NetworkNoteModal.tsx` (348 lines)

Well-implemented modal. Supports:

- Note type selector (general, threat, location, device_info)
- Free-text content area
- File attachments (drag-drop style)
- Save/Cancel actions

**Gap**: No way to view or edit previously saved notes from this modal — it is write-only. ❌

---

### 3.3 Network Detail Panel

**No dedicated network detail panel/modal found.** There is no `NetworkDetail.tsx`, `NetworkPanel.tsx`, or `NetworkInfo.tsx` component. The only place network-specific data appears is in the context menu tooltip via `renderNetworkTooltip.ts`.

This means:

- Tags are not displayed anywhere in the main UI ❌
- Notes are not displayed anywhere except via the notes count indicator in the context menu ❌
- WiGLE import history is not shown anywhere in the UI ❌

---

## 4. Filter System

### 4.1 Defined Filter Fields

**File**: `client/src/stores/filterStore.ts`

29 filter fields are defined across 7 categories:

- Identity: ssid, bssid, manufacturer, networkId
- Radio: radioTypes, frequencyBands, channelMin/Max, rssiMin/Max
- Security: encryptionTypes, authMethods, insecureFlags, securityFlags
- Temporal: timeframe, temporalScope
- Quality: observationCountMin/Max, gpsAccuracyMax, excludeInvalidCoords, qualityFilter
- Spatial: distanceFromHomeMin/Max, boundingBox, radiusFilter
- Threat: threatScoreMin/Max, threatCategories, stationaryConfidenceMin/Max

**Missing filter fields** ❌:

| Field                            | Exists in filterStore? | Server supports it?                          |
| -------------------------------- | ---------------------- | -------------------------------------------- |
| `has_notes`                      | NO                     | YES (`/api/network-tags?has_notes=true`)     |
| `tag_type`                       | NO                     | YES (`/api/network-tags?threat_tag=THREAT`)  |
| `is_ignored`                     | NO                     | YES (`/api/network-tags?ignored=true`)       |
| `wigle_v3_observation_count_min` | NO                     | NO (not in list.ts either)                   |
| `pending_wigle`                  | NO                     | YES (`/api/network-tags?pending_wigle=true`) |

---

### 4.2 Filter UI Components

**Directory**: `client/src/components/filters/sections/`

7 filter section components:

- `IdentityFilters.tsx`, `SecurityFilters.tsx`, `RadioFilters.tsx`
- `SpatialFilters.tsx`, `TimeFilters.tsx`, `QualityFilters.tsx`, `ThreatFilters.tsx`

**No tag/notes/WiGLE filter section exists.** ❌

---

### 4.3 Filter URL Parameter Assembly

**File**: `client/src/utils/networkFilterParams.ts`

The `appendNetworkFilterParams` function assembles URL params but omits:

- `has_notes` ❌
- `tag_type` / `threat_tag` ❌
- `wigle_v3_observation_count_min` ❌

Even if the filterStore had these fields, they would not be sent to the server.

---

## 5. Network Explorer Columns

### 5.1 Defined Columns

**File**: `client/src/constants/network.ts` — 43 columns in `NETWORK_COLUMNS`

Threat-related columns present: `threat`, `threat_score`, `threat_rule_score`, `threat_ml_score`, `threat_ml_weight`, `threat_ml_boost`

**Missing columns** ❌:

| Column                       | Purpose                         | In `NETWORK_COLUMNS`? | In `NetworkRow` type? | In server response?          |
| ---------------------------- | ------------------------------- | --------------------- | --------------------- | ---------------------------- |
| `notes_indicator`            | "📝" if network has notes       | NO                    | NO                    | NO                           |
| `all_tags`                   | comma-separated tag list        | NO                    | NO                    | NO                           |
| `threat_tag`                 | manual tag: THREAT/SUSPECT/etc. | NO                    | NO                    | NO (joined but not selected) |
| `is_ignored`                 | ignore flag                     | NO                    | NO                    | NO                           |
| `wigle_v3_observation_count` | WiGLE crowd obs count           | NO                    | NO                    | NO                           |
| `wigle_v3_last_import`       | last WiGLE import timestamp     | NO                    | NO                    | NO                           |

### 5.2 NetworkRow Type Gaps

**File**: `client/src/types/network.ts`

`NetworkRow` is missing:

- `notes?: string | null` — tag-level short notes
- `threat_tag?: 'THREAT' | 'SUSPECT' | 'FALSE_POSITIVE' | 'INVESTIGATE' | null`
- `is_ignored?: boolean`
- `wigle_v3_observation_count?: number | null`
- `wigle_v3_last_import_at?: string | null`

`NetworkTag` type exists separately and has the right fields, but it's never merged into `NetworkRow`. The explorer never fetches per-network tags.

---

## 6. Current Behavior Bugs & Issues

### Bug 1: Tag classification not accessible from context menu

**Severity**: HIGH
**Evidence**: `NetworkContextMenu.tsx` — only Add Note, Attach Media, Close
The `PATCH /api/network-tags/:bssid/threat`, `PATCH .../ignore`, `PATCH .../investigate` endpoints exist but have no UI entry point in the explorer. Users cannot classify networks as THREAT, SUSPECT, FALSE_POSITIVE, or INVESTIGATE without going to a separate admin UI (if one exists).

### Bug 2: `is_ignored` does not suppress threat scoring

**Severity**: HIGH
**Evidence**: `server/src/api/routes/v1/networks/list.ts` line ~562 — `LEFT JOIN app.network_tags nt` is present, but no WHERE clause filters out `nt.is_ignored = true`, and the threat score expressions do not reference `nt.is_ignored`. A network marked as "ignore" still appears in the threat list.
**Status**: UNCONFIRMED — the materialized view `api_network_explorer_mv` might handle this; needs query-level verification.

### Bug 3: Two parallel notes systems with no UI reconciliation

**Severity**: MEDIUM
**Evidence**:

- `app.network_tags.notes` (single text field, updated via `PATCH .../notes`)
- `app.network_notes` table (multiple rows per BSSID, with note_type + user_id)
  The context menu writes to `app.network_notes` (via `addNetworkNoteWithFunction`). The PATCH endpoint writes to `app.network_tags.notes`. These are independent stores — notes saved one way are invisible to the other.

### Bug 4: `list.ts` joins `network_tags` but discards all tag data

**Severity**: MEDIUM
**Evidence**: `server/src/api/routes/v1/networks/list.ts` — the JOIN is present but zero columns from `nt.*` appear in the SELECT. The explorer therefore never shows tag state for any row.

### Bug 5: Inconsistent tag vocabulary between two tag route systems

**Severity**: MEDIUM
**Evidence**:

- `network-tags/manageTags.ts`: `THREAT`, `SUSPECT`, `FALSE_POSITIVE`, `INVESTIGATE`
- `networks/tags.ts`: `LEGIT`, `FALSE_POSITIVE`, `INVESTIGATE`, `THREAT` (no SUSPECT, has LEGIT)
  Routes use different enum values for the same concept. A tag written via one route won't match queries from the other.

### Bug 6: Notes are not discoverable

**Severity**: MEDIUM
**Evidence**: No `notes_indicator` column in the explorer, no notes count in `NetworkRow`. A user cannot tell from the table whether a network has notes unless they right-click every row.

### Bug 7: `network_notes.created_at` lacks timezone

**Severity**: LOW
**Evidence**: Schema uses `timestamp without time zone` — differs from `network_tags.created_at` which uses `timestamp with time zone`. Timezone-inconsistency can cause ordering bugs and display errors.

### Bug 8: `has_notes` server filter not wired to universal filter system

**Severity**: LOW
**Evidence**: `/api/network-tags?has_notes=true` works, but the filterStore has no `has_notes` field and `appendNetworkFilterParams` never emits `has_notes=`. This capability is completely invisible to users.

---

## 7. Missing Data in Database

| Column                       | Table                          | Type                       | Why needed                                     |
| ---------------------------- | ------------------------------ | -------------------------- | ---------------------------------------------- |
| `wigle_v3_observation_count` | `app.networks`                 | `integer DEFAULT 0`        | Fast read for explorer; avoid subquery per row |
| `wigle_v3_last_import_at`    | `app.networks`                 | `timestamp with time zone` | Show recency of WiGLE enrichment               |
| (timezone fix)               | `app.network_notes.created_at` | Change to `timestamptz`    | Consistency                                    |

**Migration plan** (conceptual):

```sql
-- Add WiGLE summary columns to app.networks
ALTER TABLE app.networks
  ADD COLUMN wigle_v3_observation_count integer NOT NULL DEFAULT 0,
  ADD COLUMN wigle_v3_last_import_at    timestamp with time zone;

CREATE INDEX idx_networks_wigle_obs_count
  ON app.networks(wigle_v3_observation_count)
  WHERE wigle_v3_observation_count > 0;

-- Fix timezone on network_notes
ALTER TABLE app.network_notes
  ALTER COLUMN created_at TYPE timestamp with time zone
    USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE timestamp with time zone
    USING updated_at AT TIME ZONE 'UTC';
```

**Backward compatibility**: All additions are additive (`ADD COLUMN`). The timezone change on `network_notes` is safe (existing data treated as UTC). No existing queries break.

**Maintenance**: A trigger on `app.wigle_v3_observations` (AFTER INSERT) should increment `wigle_v3_observation_count` and set `wigle_v3_last_import_at = NOW()` on `app.networks` for the matching `bssid`.

---

## 8. Missing API Endpoints

### 8.1 Unified network detail endpoint

```
GET /api/networks/:bssid
→ {
    bssid, ssid, type, signal, security, frequency,
    observations, lat, lon,
    threat_score, threat_level,
    tag: { threat_tag, is_ignored, ignore_reason, notes, created_at, updated_at } | null,
    notes: [ { id, content, note_type, user_id, created_at } ],
    wigle: {
      observation_count: N,
      last_import_at: "ISO",
      trilat, trilon, city, region, country
    } | null
  }
```

Currently there is no single "network detail" endpoint. The frontend must make 3 separate calls to assemble this picture (network row from list, tag from `/network-tags/:bssid`, notes from adminDbService). No single GET endpoint exists.

### 8.2 Expose notes via HTTP

```
GET  /api/networks/:bssid/notes    → [ { id, content, note_type, user_id, created_at } ]
POST /api/networks/:bssid/notes    → create note
DELETE /api/networks/:bssid/notes/:noteId → delete note
```

Currently `getNetworkNotes()` is only callable internally via `adminDbService`, not via an HTTP route.

### 8.3 Batch tag operations

```
PATCH /api/network-tags/:bssid/tags → { add: ["THREAT"], remove: ["INVESTIGATE"] }
```

No batch tag mutation endpoint exists. Each tag type requires a separate PATCH call.

### 8.4 Networks list — include tag fields

The existing `GET /api/networks` should include `threat_tag`, `is_ignored`, `notes_count` in its response (currently joined but not selected). This can be a query-param opt-in: `?include_tags=true`.

---

## 9. Missing UI Components

### 9.1 NetworkTagsPanel

A panel (sidebar or modal tab) showing all tags for the selected network:

- Current `threat_tag` with confidence badge
- Current `is_ignored` state with reason
- `created_by`, `created_at`, `updated_at`
- Buttons: Mark as Threat · Mark as Suspect · False Positive · Investigate · Ignore · Clear
- Located: right-click context menu → "Tag Network" option → opens panel

### 9.2 NetworkNotesPanel / Notes tab

- List all notes from `app.network_notes` (not just tag notes field)
- Show: note_type badge, content, user_id, created_at (relative time)
- Actions: Add Note, Edit Note, Delete Note
- Currently: write-only via modal; existing notes not viewable

### 9.3 NetworkContextPanel (unified)

A tabbed "network details" panel accessible from right-click or row double-click:

- Tab 1: Tags (classification + ignore + WiGLE status)
- Tab 2: Notes (list + add)
- Tab 3: WiGLE (obs count, last import, trilat/trilon, city/region)
- Tab 4: Threat (breakdown of rule_score, ml_score, evidence)

### 9.4 NotesIndicatorColumn

A compact column in the explorer grid showing "📝" if `notes_count > 0`, empty otherwise. Requires:

- `notes_count` in NetworkRow (from server)
- Column definition in `NETWORK_COLUMNS`
- Render in `NetworkTableBodyGrid` and `NetworkTableRow`

### 9.5 Context menu tag options (highest priority)

The context menu (`NetworkContextMenu.tsx`) needs these options added:

```
─────────────────────
Mark as: [Threat ▸] [False Positive] [Investigate] [Suspect]
Ignore Network
─────────────────────
Add Note
Attach Media
─────────────────────
View Tags & Notes
─────────────────────
Close
```

---

## 10. Missing Filter Options

These filters need to be added to the universal filter system:

| Filter         | Store field                        | UI section                 | Server param                | Server support           |
| -------------- | ---------------------------------- | -------------------------- | --------------------------- | ------------------------ |
| Has notes      | `has_notes: boolean`               | New "Tags & Notes" section | `has_notes=true`            | ✅ Already exists        |
| Tag type       | `tagType: string[]`                | Tags & Notes               | `threat_tag=THREAT,SUSPECT` | ✅ Already exists        |
| Is ignored     | `isIgnored: boolean`               | Tags & Notes               | `ignored=true`              | ✅ Already exists        |
| WiGLE obs ≥ N  | `wigleObservationCountMin: number` | New "WiGLE" section        | `wigle_obs_count_min=5`     | ❌ Needs server addition |
| Has WiGLE data | `hasWigleData: boolean`            | WiGLE section              | `has_wigle=true`            | ❌ Needs server addition |

**Implementation steps for existing-server filters**:

1. Add fields to `NetworkFilters` interface in `filterStore.ts`
2. Add to `enabled` map defaults
3. Add `TagsNotesFilters.tsx` component
4. Wire in `appendNetworkFilterParams`
5. Wire in `filterCapabilities.ts` for relevant pages

---

## 11. Missing Explorer Columns

| Column key                   | Header       | Source                                              | Type        | Sort? |
| ---------------------------- | ------------ | --------------------------------------------------- | ----------- | ----- |
| `notes_count`                | Notes        | `app.network_notes COUNT` subquery                  | number      | yes   |
| `threat_tag`                 | Tag          | `app.network_tags.threat_tag`                       | string enum | yes   |
| `is_ignored`                 | Ignored      | `app.network_tags.is_ignored`                       | boolean     | yes   |
| `wigle_v3_observation_count` | WiGLE Obs    | `app.networks.wigle_v3_observation_count` (new col) | number      | yes   |
| `wigle_v3_last_import`       | WiGLE Import | `app.networks.wigle_v3_last_import_at` (new col)    | date        | yes   |

**To add a column**:

1. Add to `NetworkRow` type (`client/src/types/network.ts`)
2. Add to `NETWORK_COLUMNS` constant (`client/src/constants/network.ts`)
3. Add to server SELECT in `list.ts`
4. Add render case in `NetworkTableBodyGrid.tsx` + `NetworkTableRow.tsx`
5. Add to `mapApiRowToNetwork` in `networkDataTransformation.ts`

---

## 12. Implementation Roadmap

### Priority 1 — Critical Data Visibility

#### 1a. Database migration (new columns + timezone fix)

- ADD `wigle_v3_observation_count integer DEFAULT 0` to `app.networks`
- ADD `wigle_v3_last_import_at timestamptz` to `app.networks`
- Fix `app.network_notes.created_at/updated_at` → `timestamptz`
- Add trigger: on INSERT into `wigle_v3_observations` → increment counter + set timestamp
- **Migration file**: `sql/migrations/20260222_network_tagging_additions.sql`

#### 1b. Fix `list.ts`: include tag columns in response

- Add to SELECT: `nt.threat_tag, nt.is_ignored, nt.ignore_reason, nt.notes AS tag_notes`
- Add subquery: `(SELECT COUNT(*) FROM app.network_notes nn WHERE nn.bssid = ne.bssid) AS notes_count`
- Add to `NetworkRow` type: `threat_tag`, `is_ignored`, `notes_count`
- Add to `mapApiRowToNetwork` in `networkDataTransformation.ts`

#### 1c. Context menu: add tag classification options

- Add "Mark as Threat / False Positive / Investigate / Suspect" submenu to `NetworkContextMenu.tsx`
- Add "Ignore Network" option
- Wire to existing `PATCH /api/network-tags/:bssid/threat` and `PATCH .../ignore`
- Display current tag state (check via stored NetworkTag data or fetch on open)

#### 1d. Explorer columns: add `threat_tag`, `is_ignored`, `notes_count`

- Add to `NETWORK_COLUMNS` with appropriate widths
- Add render cases to both table components

#### 1e. Create `GET /api/networks/:bssid/notes` HTTP endpoint

- New route module: `server/src/api/routes/v1/networks/notes.ts`
- `GET /:bssid/notes` → calls `adminDbService.getNetworkNotes(bssid)`
- `POST /:bssid/notes` → calls `addNetworkNoteWithFunction`
- `DELETE /:bssid/notes/:id` → calls `deleteNetworkNote`

---

### Priority 2 — Functionality Fixes

#### 2a. Verify and fix `is_ignored` suppression

- Check `app.api_network_explorer_mv` definition — does it filter `is_ignored = true`?
- If not: add `WHERE (nt.is_ignored IS NULL OR nt.is_ignored = false)` to threat queries
- Or: add to list.ts WHERE clause when `show_ignored` param is absent

#### 2b. Consolidate notes systems

- Decide: `network_tags.notes` (legacy short text) vs `network_notes` table (structured)
- Recommendation: deprecate `network_tags.notes`; all notes go to `app.network_notes`
- Migrate existing `network_tags.notes` data to `network_notes` table

#### 2c. Resolve tag vocabulary inconsistency

- Standardize on: `THREAT`, `SUSPECT`, `FALSE_POSITIVE`, `INVESTIGATE` (from manageTags.ts)
- Remove `LEGIT` from `networks/tags.ts` or map it → `FALSE_POSITIVE`
- Single source of truth: `VALID_THREAT_TAGS` in `manageTags.ts`

#### 2d. NetworkNotesPanel — show existing notes in context menu

- Expand `NetworkContextMenu` or add a "View Notes" option
- Render list of existing notes fetched from `GET /api/networks/:bssid/notes`
- Allow edit/delete of each note

---

### Priority 3 — Filters & Discoverability

#### 3a. Add `TagsNotesFilters.tsx` component

- `has_notes`: boolean toggle ("Only show networks with notes")
- `tagType`: multi-select (THREAT, SUSPECT, FALSE_POSITIVE, INVESTIGATE)
- `isIgnored`: tri-state (show all / show only ignored / hide ignored)

#### 3b. Wire tag filters to universal filter system

- Add `has_notes`, `tagType`, `isIgnored` to `NetworkFilters` in `filterStore.ts`
- Add to `appendNetworkFilterParams`
- Register in `filterCapabilities.ts` for geospatial + dashboard pages

#### 3c. Add WiGLE data to network list response

- Add `wigle_v3_observation_count`, `wigle_v3_last_import_at` to SELECT in `list.ts`
- Add `wigle_v3_observation_count_min` filter param to server list endpoint
- Add `wigle_v3_observation_count` column to NETWORK_COLUMNS

#### 3d. Add `NotesIndicatorColumn` to explorer

- Render "📝 N" badge if `notes_count > 0`
- Sortable by notes_count

#### 3e. Create `GET /api/networks/:bssid` unified detail endpoint

- Single endpoint returning network + tags + notes + WiGLE summary
- Used by any future NetworkDetailPanel

---

## Summary Table

| Area                              | Status       | Gaps                                                    |
| --------------------------------- | ------------ | ------------------------------------------------------- |
| DB schema (created_at/updated_at) | ✅ Present   | `network_notes` timezone inconsistency                  |
| DB schema (wigle counters)        | ❌ Missing   | `wigle_v3_observation_count`, `wigle_v3_last_import_at` |
| Tag read API                      | ✅ Exists    | —                                                       |
| Tag write API                     | ✅ Exists    | Vocabulary inconsistency                                |
| Notes HTTP API                    | ❌ Missing   | No public HTTP endpoint                                 |
| Unified detail API                | ❌ Missing   | No `GET /api/networks/:bssid`                           |
| Context menu tagging              | ❌ Missing   | Only Add Note + Attach Media                            |
| Notes viewability                 | ❌ Missing   | Write-only modal; no list view                          |
| Network detail panel              | ❌ Missing   | Component does not exist                                |
| Explorer tag columns              | ❌ Missing   | Not in NetworkRow / NETWORK_COLUMNS                     |
| Notes indicator column            | ❌ Missing   | —                                                       |
| WiGLE columns in explorer         | ❌ Missing   | —                                                       |
| `has_notes` filter                | ❌ Missing   | Server supports; not wired to UI                        |
| `tag_type` filter                 | ❌ Missing   | Server supports; not wired to UI                        |
| `is_ignored` filter               | ❌ Missing   | Server supports; not wired to UI                        |
| `is_ignored` suppresses threats   | ⚠ UNVERIFIED | Needs query audit                                       |
