#!/usr/bin/env python3
"""
Import surveillance camera locations from FLOCK/CAMERAS_WITH_NETWORK_DATA.geojson
into app.deflock_cameras.

The FLOCK GeoJSON is treated as an authoritative snapshot. Exact (lat, lon)
conflicts refresh source-owned metadata while preserving the existing primary key.

Usage:
  python3 scripts/import_flock_repo.py
  python3 scripts/import_flock_repo.py --input /path/to/source.geojson
  python3 scripts/import_flock_repo.py --dry-run
"""

from __future__ import annotations

import argparse
import json
import os
import re
from collections.abc import Iterable
from decimal import Decimal
from typing import Any

GEOJSON_PATH = os.path.join(
    os.path.dirname(__file__),
    "../../FLOCK/CAMERAS_WITH_NETWORK_DATA.geojson",
)
BATCH_SIZE = 1000
SOURCE = "FLOCK_REPO"


def json_dumps_preserving_decimals(value: Any) -> str:
    """Serialize Decimal values as JSON numbers instead of losing source precision."""
    marker_prefix = "__DECIMAL_VALUE__"
    encoded = json.dumps(
        value,
        default=lambda item: f"{marker_prefix}{item}__",
        separators=(",", ":"),
    )
    return re.sub(
        rf'"{re.escape(marker_prefix)}([^"]+)__"',
        lambda match: match.group(1),
        encoded,
    )


def first_value(props: dict[str, Any], *keys: str) -> Any:
    """Return the first non-empty source value using the declared precedence."""
    for key in keys:
        value = props.get(key)
        if value not in (None, ""):
            return value
    return None


def extract_location(props: dict[str, Any]) -> tuple[str | None, str | None, str | None]:
    """Extract legacy location fields while retaining all source properties separately."""
    city = first_value(props, "addr:city", "city", "is_in:city")
    state = first_value(props, "addr:state", "is_in:state_code", "is_in:state")
    agency = first_value(props, "operator")
    return city, state, agency


def extract_metadata(props: dict[str, Any]) -> dict[str, Any]:
    """Map useful fields to typed columns and retain the complete source property object."""
    city, state, agency = extract_location(props)
    return {
        "source_id": str(first_value(props, "osm_id", "id", "ref") or "") or None,
        "camera_type": first_value(props, "camera:type", "surveillance:type"),
        "agency": agency,
        "operator": agency,
        "name": first_value(props, "name"),
        "address": first_value(props, "addr:full", "address"),
        "street": first_value(props, "addr:street"),
        "housenumber": first_value(props, "addr:housenumber"),
        "postcode": first_value(props, "addr:postcode"),
        "city": city,
        "state": state,
        "country": first_value(props, "addr:country", "country"),
        "manufacturer": first_value(props, "manufacturer", "camera:manufacturer"),
        "manufacturer_wikidata": first_value(
            props, "manufacturer:wikidata", "camera:manufacturer:wikidata"
        ),
        "direction": first_value(props, "direction", "camera:direction"),
        "camera_mount": first_value(props, "camera:mount", "mount"),
        "surveillance": first_value(props, "surveillance"),
        "surveillance_type": first_value(props, "surveillance:type"),
        "surveillance_zone": first_value(props, "surveillance:zone"),
        "electricity": first_value(props, "electricity"),
        "website": first_value(props, "website", "contact:website"),
        "source_properties": props,
    }


def load_features(path: str) -> list[dict[str, Any]]:
    print(f"[FLOCK Import] Loading {path} ...")
    with open(path, encoding="utf-8") as handle:
        data = json.load(handle, parse_float=Decimal)
    features = data.get("features", [])
    print(f"[FLOCK Import] Loaded {len(features)} features")
    return features


def build_rows(
    features: Iterable[dict[str, Any]],
) -> tuple[list[dict[str, Any]], int, int]:
    """Validate points and retain the last feature for each exact coordinate."""
    rows_by_coordinate: dict[tuple[Decimal, Decimal], dict[str, Any]] = {}
    skipped = 0
    duplicate_coordinates = 0

    for feature in features:
        geometry = feature.get("geometry") or {}
        if geometry.get("type") != "Point":
            skipped += 1
            continue

        coordinates = geometry.get("coordinates", [])
        if len(coordinates) < 2:
            skipped += 1
            continue

        lon, lat = coordinates[0], coordinates[1]
        if lat is None or lon is None:
            skipped += 1
            continue

        props = feature.get("properties") or {}
        coordinate = (lat, lon)
        if coordinate in rows_by_coordinate:
            duplicate_coordinates += 1
        rows_by_coordinate[coordinate] = {
            "lat": lat,
            "lon": lon,
            **extract_metadata(props),
        }

    return list(rows_by_coordinate.values()), skipped, duplicate_coordinates


def run_import(rows: list[dict[str, Any]], dry_run: bool) -> dict[str, int]:
    if dry_run:
        print("[FLOCK Import] DRY RUN — first 5 rows:")
        for row in rows[:5]:
            print(
                f"  lat={row['lat']} lon={row['lon']} "
                f"source_id={row['source_id']!r} camera_type={row['camera_type']!r} "
                f"city={row['city']!r} state={row['state']!r} agency={row['agency']!r}"
            )
        return {"inserted": 0, "updated": 0}

    import psycopg2  # type: ignore
    from psycopg2.extras import Json  # type: ignore

    conn = psycopg2.connect(
        host=os.environ.get("DB_HOST", "localhost"),
        port=int(os.environ.get("DB_PORT", 5432)),
        dbname=os.environ.get("DB_NAME", "shadowcheck_db"),
        user=os.environ.get("DB_USER", "shadowcheck_admin"),
        password=os.environ.get("DB_PASSWORD", ""),
    )

    inserted = 0
    updated = 0
    total = len(rows)
    try:
        with conn:
            with conn.cursor() as cur:
                for start in range(0, total, BATCH_SIZE):
                    batch = rows[start : start + BATCH_SIZE]
                    for row in batch:
                        params = {
                            **row,
                            "source": SOURCE,
                            "source_properties": Json(
                                row["source_properties"],
                                dumps=json_dumps_preserving_decimals,
                            ),
                        }
                        cur.execute(
                            """
                            INSERT INTO app.deflock_cameras (
                              lat, lon, source_id, camera_type, agency, operator, name,
                              address, street, housenumber, postcode, city, state, country,
                              manufacturer, manufacturer_wikidata, direction, camera_mount,
                              surveillance, surveillance_type, surveillance_zone, electricity,
                              website, source_properties, source, imported_at
                            )
                            VALUES (
                              %(lat)s, %(lon)s, %(source_id)s, %(camera_type)s, %(agency)s,
                              %(operator)s, %(name)s, %(address)s, %(street)s, %(housenumber)s,
                              %(postcode)s, %(city)s, %(state)s, %(country)s, %(manufacturer)s,
                              %(manufacturer_wikidata)s, %(direction)s, %(camera_mount)s,
                              %(surveillance)s, %(surveillance_type)s, %(surveillance_zone)s,
                              %(electricity)s, %(website)s, %(source_properties)s, %(source)s,
                              NOW()
                            )
                            ON CONFLICT (lat, lon) DO UPDATE SET
                              source_id = EXCLUDED.source_id,
                              camera_type = EXCLUDED.camera_type,
                              agency = EXCLUDED.agency,
                              operator = EXCLUDED.operator,
                              name = EXCLUDED.name,
                              address = EXCLUDED.address,
                              street = EXCLUDED.street,
                              housenumber = EXCLUDED.housenumber,
                              postcode = EXCLUDED.postcode,
                              city = EXCLUDED.city,
                              state = EXCLUDED.state,
                              country = EXCLUDED.country,
                              manufacturer = EXCLUDED.manufacturer,
                              manufacturer_wikidata = EXCLUDED.manufacturer_wikidata,
                              direction = EXCLUDED.direction,
                              camera_mount = EXCLUDED.camera_mount,
                              surveillance = EXCLUDED.surveillance,
                              surveillance_type = EXCLUDED.surveillance_type,
                              surveillance_zone = EXCLUDED.surveillance_zone,
                              electricity = EXCLUDED.electricity,
                              website = EXCLUDED.website,
                              source_properties = EXCLUDED.source_properties,
                              source = EXCLUDED.source,
                              imported_at = NOW()
                            RETURNING (xmax = 0) AS inserted
                            """,
                            params,
                        )
                        if cur.fetchone()[0]:
                            inserted += 1
                        else:
                            updated += 1

                    done = min(start + BATCH_SIZE, total)
                    if done % 5000 < BATCH_SIZE or done == total:
                        print(
                            f"[FLOCK Import] Progress: {done}/{total} processed, "
                            f"{inserted} inserted, {updated} updated"
                        )
    finally:
        conn.close()

    return {"inserted": inserted, "updated": updated}


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Import FLOCK repo camera GeoJSON into app.deflock_cameras"
    )
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--input", default=GEOJSON_PATH)
    args = parser.parse_args()

    features = load_features(args.input)
    rows, skipped, duplicate_coordinates = build_rows(features)
    print(
        f"[FLOCK Import] {len(rows)} distinct valid rows to import "
        f"({skipped} skipped, {duplicate_coordinates} duplicate exact coordinates)"
    )

    counts = run_import(rows, dry_run=args.dry_run)
    if not args.dry_run:
        print(
            f"[FLOCK Import] Done. Inserted {counts['inserted']} new rows and "
            f"updated {counts['updated']} existing rows in app.deflock_cameras"
        )


if __name__ == "__main__":
    main()
