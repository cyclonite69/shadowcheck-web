# VISINT Evidence Pipeline

Visual Intelligence (VISINT) is the evidence correlation path for field-captured
media (`image/jpeg`, `image/png`, and `video/mp4`). It is **distinct from passive radio classification**
(surveillance detection, BWC signatures, DeFlock/ShotSpotter matching): VISINT
processes operator-submitted media to extract GPS/timestamp metadata and
correlate that context against observed radio signals.

Related: [Surveillance Detection & Equipment Guides](surveillance-detection.md) —
the classification system that assigns device types used by the VISINT scorer.

---

## 1. Purpose

VISINT allows operators to:

1. **Upload** a field image or MP4 with embedded GPS/timestamp metadata.
2. **Correlate** that media against `app.observations` within a configurable
   spatial radius and time window.
3. **Review** a ranked candidate list with scores and proposed tags in
   **preview mode** (default — no database writes).
4. **Commit** a chosen attachment with `commit=true` (or `manual_override=true`
   via the attach endpoint), which writes to `app.network_media` and applies
   tags to `app.network_tags`.

VISINT evidence provides **context** for analysts. A VISINT attachment is not
automatic proof of a device classification; scoring and tagging communicate
confidence but do not replace human review.

---

## 2. API Entry Points

All VISINT endpoints accept `multipart/form-data`. They are registered under the
observations router:
[server/src/api/routes/v1/networks/observations.ts](../../server/src/api/routes/v1/networks/observations.ts)

### `POST /api/observations/correlate-visint`

Auto-correlates uploaded media against the database.

| Field           | Type                      | Required | Notes                                                 |
| --------------- | ------------------------- | -------- | ----------------------------------------------------- |
| `image`         | file (multipart)          | ✅       | `image/jpeg`, `image/png`, or `video/mp4`, max 100 MB |
| `commit`        | string (`"true"/"false"`) | No       | Defaults to `false`. Must be `"true"` to persist.     |
| `radius_meters` | number                    | No       | Spatial search radius (default: 50 m)                 |
| `window_hours`  | number                    | No       | Time window ± around media timestamp (default: 2 h)   |
| `limit`         | number                    | No       | Max candidates returned (default: 5)                  |
| `filename`      | string                    | No       | Falls back to `original_filename`, then `image.jpg`   |

**Behavior:**

- Detects actual file content with ExifTool and requires it to agree with the
  declared multipart MIME type; only JPEG, PNG, and MP4 are accepted.
- Extracts image EXIF GPS and `DateTimeOriginal` (with `OffsetTimeOriginal` if
  present), or MP4 container GPS and creation-time metadata.
- Queries `app.observations` using PostGIS `ST_DWithin` + time range + signature scoring.
- Returns scored candidates.
- If `commit=false` (default): derives tag set but **does not write** to any table.
- If `commit=true`: persists to `app.network_media` and `app.network_tags` for the top match.

**Error responses:**

| HTTP                                  | Condition                                                            |
| ------------------------------------- | -------------------------------------------------------------------- |
| 400                                   | Missing media file                                                   |
| 400 (`INVALID_FILE_TYPE`)             | Unsupported or mismatched declared/content media type                |
| 400 (`ExifMissingError`)              | EXIF GPS or timestamp fields absent or unparseable                   |
| 400 (`VISINT_INVALID_NUMERIC_PARAMS`) | `radius_meters`, `window_hours`, or `limit` provided but non-numeric |
| 413                                   | Media exceeds 100 MB                                                 |
| 503 (`ExifToolUnavailableError`)      | `exiftool` binary not installed in API runtime                       |

---

### `POST /api/observations/attach-visint`

Commits a VISINT media attachment to a specific, operator-selected BSSID (the "manual
attachment" path). Always writes to `app.network_media` and `app.network_tags`.

| Field              | Type             | Required | Notes                                                                                            |
| ------------------ | ---------------- | -------- | ------------------------------------------------------------------------------------------------ |
| `image`            | file (multipart) | ✅       | `image/jpeg`, `image/png`, or `video/mp4`, max 100 MB                                            |
| `bssid`            | string           | No       | Target BSSID. Defaults to `VISINT_UNMATCHED` sentinel.                                           |
| `detection_score`  | integer          | No       | Score from correlate-visint response.                                                            |
| `dist_meters`      | number           | No       | Distance from correlate-visint response.                                                         |
| `delta_minutes`    | number           | No       | Time delta from correlate-visint response.                                                       |
| `lat`              | number           | No       | Image GPS latitude.                                                                              |
| `lon`              | number           | No       | Image GPS longitude.                                                                             |
| `ts`               | string           | No       | Image capture timestamp.                                                                         |
| `manual_override`  | `"true"`         | No       | Set to `"true"` for ground-truth attachment (applies `VISINT_CONFIRMED` + `GROUND_TRUTH_IMAGE`). |
| `device_type`      | string           | No       | e.g., `SHOTSPOTTER_SENSOR`, `FLOCK_SAFETY_CAMERA`                                                |
| `confirm_fallback` | `"true"`         | No       | Required when `bssid` is `VISINT_UNMATCHED`. Explicit opt-in guard.                              |

**Error responses:**

| HTTP                                          | Condition                                                                |
| --------------------------------------------- | ------------------------------------------------------------------------ |
| 400                                           | Missing media file                                                       |
| 400 (`VISINT_INVALID_NUMERIC_PARAMS`)         | `dist_meters`, `delta_minutes`, `lat`, or `lon` provided but non-numeric |
| 400 (`VISINT_INVALID_DETECTION_SCORE`)        | `detection_score` provided but non-integer                               |
| 400 (`VISINT_FALLBACK_REQUIRES_CONFIRMATION`) | `bssid=VISINT_UNMATCHED` without `confirm_fallback=true`                 |

---

### `POST /api/admin/network-media/upload` (separate path)

Admin-only media upload: accepts base64-encoded media in JSON body. Not
VISINT-specific; used for attaching arbitrary supported media to a BSSID
without correlation scoring. See
[media.ts](../../server/src/api/routes/v1/admin/media.ts).

---

## 3. Pipeline Stages

### Stage 1 — Upload & Request Parsing

The route handler uses `multer` (memory storage, 100 MB limit) and accepts only
`image/jpeg`, `image/png`, and `video/mp4`.
The file buffer is passed in memory; nothing is written to disk at this stage.
`commit` defaults to `false` if omitted or falsy.

Before telemetry extraction, ExifTool inspects the file contents. Its detected
MIME type must exactly match the multipart declaration, so arbitrary bytes
labeled `video/mp4`, renamed non-MP4 files, and other video formats are rejected.

Malformed numeric query parameters (`radius_meters`, `window_hours`, `limit`)
are rejected with `400` **before** any pipeline execution — the media is never
read.

### Stage 2 — EXIF Extraction (`visintExif.ts`)

The buffer is written to a temp file in `os.tmpdir()` for processing:

```
exiftool -n -p $GPSLatitude    <file>
exiftool -n -p $GPSLongitude   <file>
exiftool -d '%Y-%m-%d %H:%M:%S' -p $DateTimeOriginal <file>
exiftool -p $OffsetTimeOriginal <file>   ← optional
```

The image calls run in parallel via `Promise.all`. MP4 metadata is extracted
with `exiftool -a -G1 -s -j -n -api QuickTimeUTC=0 <file>`, including
`Composite:GPSLatitude`, `Composite:GPSLongitude`, `QuickTime:CreateDate`, and
`QuickTime:Duration`. The temp file is deleted in a `finally` block regardless
of success or failure.

**Timezone offset handling:** If `OffsetTimeOriginal` is present (e.g., `-05:00`),
it is appended to `DateTimeOriginal` to form a timezone-aware timestamp. This
prevents systematic time-delta errors in the correlation window when the image
was captured outside UTC.

For MP4, the provenance is returned as `timestamp_source`,
`timestamp_is_start_estimate`, and `duration_s`. `container_creation` means the
container timestamp is used as-is; `container_creation_minus_duration` marks an
estimated start time; `filename_with_offset` marks the filename fallback when
container creation time is unavailable and an embedded UTC offset exists.
There are no dedicated database columns for these three provenance values;
MP4 attachment descriptions retain them as JSON alongside the extracted
coordinates and timestamp.

Error classes raised:

- `ExifMissingError` — GPS or timestamp fields are missing or contain
  non-numeric coordinate values. Returns `400`.
- `ExifToolUnavailableError` — `exiftool` binary not found (`ENOENT`).
  Returns `503`.

### Stage 3 — Candidate Matching & Scoring (`visintScorer.ts`)

Calls `queryCorrelatedObservations` against `app.observations` using:

```sql
WHERE ST_DWithin(obs_geom, image_geom, $radius_meters)
  AND observed_at BETWEEN ($ts - window_hours) AND ($ts + window_hours)
ORDER BY delta_minutes ASC, detection_score DESC, dist_meters ASC
LIMIT $limit
```

**Candidate ordering priority:** tightest time delta first (primary), then
highest detection score, then nearest distance. This reflects the 2026-06-04
change (`feat(visint): prioritize tightest time delta`) that reversed the
previous score-first ordering to avoid false-positive high-score matches that
were temporally distant.

**Scoring (CASE expression in scorer):**

| Score | Condition                                                                                | `device_type`         |
| ----- | ---------------------------------------------------------------------------------------- | --------------------- |
| 4     | BLE `radio_service` contains UUID `3e1d50cd-7e3e-427d-8e1c-b78aa87fe624`                 | `FLOCK_SAFETY_CAMERA` |
| 3     | SSID matches `^[0-9]{10}$` or `^Penguin-[0-9]{10}$`                                      | `FLOCK_SAFETY_CAMERA` |
| 2     | SSID matches `^(SoundThinking\|ShotSpotter\|SST-)`                                       | `SHOTSPOTTER_SENSOR`  |
| 2     | SSID matches `^(CBCI\|HOME\|CAR\|BT\|GC\|LB\|MTS\|AUTO\|TFGF\|KG\|RN\|JB\|JR\|JW)-[0-9]` | `SHOTSPOTTER_SENSOR`  |
| 1     | `ssid = '4'` AND `radio_type = 'E'` (BLE)                                                | `FLOCK_SAFETY_CAMERA` |
| 0     | No signature match — spatial/temporal candidate only                                     | `NULL`                |

A match is only considered successful if the top candidate has `detection_score >= 1`.
Score-0 rows are returned as candidates but do not trigger a `MATCHED` status.

### Stage 4 — Preview Response (default, `commit=false`)

If `commit=false`:

- `deriveVisintTags()` is called to compute what tags _would_ be applied.
- No rows are written to `app.network_media`, `app.network_tags`, or any other table.
- The response includes `status`, `observation_id`, `detection_score`, distances,
  the derived `tags_applied` list, extracted EXIF, and the full `candidates` array.

This is the **safety contract**: operators see the full correlation result before
deciding whether to commit.

### Stage 5 — Explicit Persistence (`commit=true`)

If `commit=true`, `saveVisINTAttachment()` is called, which:

1. **Writes to `app.network_media`** via `insertNetworkMedia()`:
   - Stores the image buffer, filename, MIME type, file size, and a description
     string encoding distance/delta/score/manual flag metadata.
   - For unmatched images, the description JSON encodes `extracted_lat/lon/ts`.
   - For MP4, the description JSON also retains timestamp provenance and duration;
     `thumbnail` remains `NULL` because VISINT has no video-thumbnail path.

2. **Derives the tag set** via `deriveVisintTags()`.

3. **Writes to `app.network_tags`** via `adminNetworkTagOuiRepository`:
   - If no tag row exists for the BSSID: `insertNetworkTagWithNotes()`.
   - If a tag row already exists: `addTagToNetwork()` for each new tag.

> [!NOTE]
> VISINT **does not write to `app.surveillance_detections`** directly. The
> incident ADR confirmed that media id `8` had no `surveillance_detections` row.
> Detection classification is managed separately by `surveillanceDetectionRepository`.

---

## 4. Tag Derivation Logic (`deriveVisintTags`)

Tags are determined by four factors: target BSSID, detection score, device type,
and whether the attachment is a manual override.

```
VISINT_UNMATCHED sentinel BSSID → UNMATCHED_NODE, VISINT_UNMATCHED
                                   (always, regardless of score or manual flag)

Manual override to a real BSSID → VISINT_SPATIAL_MATCH, VISINT_MANUAL_MATCH,
                                   VISINT_CONFIRMED, GROUND_TRUTH_IMAGE
                                   + device-type tag if SHOTSPOTTER_SENSOR or FLOCK_*

Auto-matched ShotSpotter (score ≥ 2) → SHOTSPOTTER_SENSOR, VISINT_VERIFIED
Auto-matched ShotSpotter (score 1)   → SHOTSPOTTER_SENSOR, VISINT_PENDING

Auto-matched Flock (score 4) → FLOCK_NEW_FIRMWARE, VISINT_VERIFIED
Auto-matched Flock (score 3) → FLOCK_LEGACY, VISINT_VERIFIED
Auto-matched Flock (score 1) → FLOCK_CANDIDATE, VISINT_PENDING

Auto-matched score ≥ 1, unknown device type → VISINT_PENDING
Auto-matched score 0, real BSSID           → VISINT_SPATIAL_MATCH only
```

---

## 5. ShotSpotter Confirmed Attachment

`feat(visint): support confirmed ShotSpotter attachments` (`5664e94c`) introduced
the `manual_override` + `device_type=SHOTSPOTTER_SENSOR` path on
`/attach-visint`.

When `manual_override=true` and `device_type=SHOTSPOTTER_SENSOR`:

- The tag set includes `SHOTSPOTTER_SENSOR` alongside the ground-truth
  evidence tags (`VISINT_CONFIRMED`, `VISINT_MANUAL_MATCH`, `GROUND_TRUTH_IMAGE`,
  `VISINT_SPATIAL_MATCH`).
- This is distinct from auto-match: the operator explicitly asserts that the
  image evidence corresponds to a ShotSpotter sensor at that BSSID location.
- Score-based `VISINT_VERIFIED` / `VISINT_PENDING` tags are **not** applied on
  manual override paths — `VISINT_CONFIRMED` replaces them.

---

## 6. Safety Contract

> [!CAUTION]
> `commit` defaults to `false`. If omitted, **no rows are written** to any table.
> This is a hard invariant enforced at the route level and tested explicitly.

### Current contract (post-incident patch)

- **`correlate-visint`** without `commit=true`: correlation runs, preview tags
  are derived, nothing is persisted.
- **`correlate-visint`** with `commit=true`: writes to `app.network_media` and
  `app.network_tags` for the top candidate only.
- **`attach-visint`**: always writes (explicit commit endpoint — operator chose
  a specific target). Sentinel BSSID (`VISINT_UNMATCHED`) requires
  `confirm_fallback=true` as an additional guard.
- Malformed numeric inputs return `400` before any extraction or query executes.
- Missing `exiftool` returns `503` (not `500`) to distinguish infrastructure
  misconfiguration from pipeline errors.

### Prior incident — silent fallback writes

See [20260607_visint_evidence_integrity_incident.md](../ai/decisions/20260607_visint_evidence_integrity_incident.md).

The root cause was that the server previously defaulted omitted `commit` to
`true`, turning exploratory correlation requests into silent database writes.
Agent-created rows `5`, `6`, `7`, `9`, and `10` were written this way and
subsequently deleted. The default was flipped to `false` and confirmed by tests.

**Lesson for future agents:** Do not call `correlate-visint` with `commit=true`
or call `attach-visint` against the working database without explicit operator
approval of the exact write. Both endpoints are marked `manualOnly: true` in
`apiTestEndpoints.ts` precisely to prevent automated test runners from
accidentally persisting rows.

---

## 7. Persistence Targets Summary

| Table                         | Written by                                          | When                                              |
| ----------------------------- | --------------------------------------------------- | ------------------------------------------------- |
| `app.network_media`           | `insertNetworkMedia()`                              | `commit=true` on correlate, or any call to attach |
| `app.network_tags`            | `addTagToNetwork()` / `insertNetworkTagWithNotes()` | Same as above                                     |
| `app.surveillance_detections` | **Not written by VISINT**                           | Detection classification is separate              |

---

## 8. Verification Tests

| Test file                                       | What it protects                                                                                                                                                                        |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/unit/visintTagDerivation.test.ts`        | `deriveVisintTags` — all tag derivation paths: sentinel, manual override, auto-matched ShotSpotter/Flock, spatial-only                                                                  |
| `tests/unit/visintUploaderApiPath.test.ts`      | Frontend uses relative paths (no double `/api`); multipart FormData; API test endpoints marked `manualOnly`                                                                             |
| `tests/integration/api/v1/observations.test.ts` | Route-level: `commit=false` default; explicit `commit=true`; malformed numeric 400; ExifMissingError 400; ExifToolUnavailableError 503; sentinel BSSID requires `confirm_fallback=true` |
| `tests/unit/observationService.test.ts`         | Service-level: no-write when commit omitted; media+tag write when `commit=true`; ShotSpotter tag on SSID match; ExifMissingError propagation                                            |

---

## 9. Known Limitations & Open Questions

- **Scorer semantics audit (open):** Several SSID-only scoring rules (e.g.,
  `HOME-*`, `CAR-*`, `BT-*` CBCI patterns) were noted in the incident ADR as
  potentially broad. A dedicated "VISINT scorer semantics audit" workstream was
  called out but not yet executed. Until that audit runs, scorer results for
  those SSID prefixes should be treated as candidates, not verified matches.

- **`app.surveillance_detections` is not written:** Tags written by VISINT
  are in `app.network_tags` only. The media attachment does not automatically
  produce a `surveillance_detections` row; those are created by the passive
  detection scan (`surveillanceDetectionRepository.ts`). An operator tagging
  `SHOTSPOTTER_SENSOR` via VISINT does not create a detection record.

- **SHA-256 duplicate prevention:** VISINT rejects identical media bytes with
  `VISINT_DUPLICATE_MEDIA`, independent of filename or upload path. Existing
  explicit media deletion remains the way to remove an attachment and permit a
  later re-upload.

- **exiftool runtime dependency:** The API container must have `exiftool`
  installed. If absent, all correlate requests return `503`. The frontend
  uploader (`VisIntUploader.tsx`) handles this with a user-visible error state.
