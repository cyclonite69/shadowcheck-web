#!/usr/bin/env python3
"""
Audit ShadowCheck migrations for consolidation planning.
Analyzes migration files and groups them by type/purpose.
"""

import re
from pathlib import Path
from collections import defaultdict


MIGRATIONS_DIR = Path("sql/migrations")


def parse_migration(filepath):
    """Extract metadata from migration file."""
    with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()

    categories = []
    objects = []

    if re.search(r"CREATE TABLE|ALTER TABLE.*ADD COLUMN", content, re.I):
        categories.append("SCHEMA")
        objects.extend(re.findall(r"CREATE TABLE\s+(\S+)", content, re.I))

    if re.search(r"CREATE INDEX|DROP INDEX", content, re.I):
        categories.append("INDEX")
        objects.extend(re.findall(r"CREATE INDEX\s+(\S+)", content, re.I))

    if re.search(r"CREATE.*VIEW|DROP VIEW", content, re.I):
        categories.append("VIEW")
        objects.extend(re.findall(r"CREATE.*VIEW\s+(\S+)", content, re.I))

    if re.search(r"CREATE.*FUNCTION|CREATE.*PROCEDURE", content, re.I):
        categories.append("FUNCTION")
        objects.extend(re.findall(r"CREATE.*FUNCTION\s+(\S+)\(", content, re.I))

    if re.search(r"INSERT INTO|COPY.*FROM", content, re.I):
        categories.append("DATA")

    if re.search(r"ALTER DATABASE|SET ", content, re.I):
        categories.append("SETTINGS")

    if re.search(r"CREATE TRIGGER|DROP TRIGGER", content, re.I):
        categories.append("TRIGGER")

    is_versioned = bool(re.search(r"_v\d+|_improved|_fixed|_updated", filepath.name))

    return {
        "filename": filepath.name,
        "path": str(filepath),
        "size": filepath.stat().st_size,
        "categories": categories or ["UNKNOWN"],
        "objects": objects,
        "is_versioned": is_versioned,
        "content_preview": content[:200].replace("\n", " "),
    }


def find_duplicates(migrations):
    """Find migrations that might be superseded versions."""
    base_names = defaultdict(list)

    for m in migrations:
        base = re.sub(r"_v\d+|_improved|_fixed|_updated|_final", "", m["filename"])
        base_names[base].append(m)

    return {k: v for k, v in base_names.items() if len(v) > 1}


def main():
    print("=" * 80)
    print("SHADOWCHECK MIGRATION AUDIT")
    print("=" * 80)
    print()

    migration_files = sorted(MIGRATIONS_DIR.glob("*.sql"))
    migrations = [parse_migration(f) for f in migration_files]

    print(f"Total migrations: {len(migrations)}")
    print()

    # Group by category
    print("=" * 80)
    print("BREAKDOWN BY CATEGORY")
    print("=" * 80)
    by_category = defaultdict(list)
    for m in migrations:
        for cat in m["categories"]:
            by_category[cat].append(m)

    for cat in sorted(by_category.keys()):
        files = by_category[cat]
        print(f"\n{cat}: {len(files)} files")
        for f in files[:5]:
            print(f"  - {f['filename']}")
        if len(files) > 5:
            print(f"  ... and {len(files) - 5} more")

    # Find versioned migrations (candidates for consolidation)
    print("\n" + "=" * 80)
    print("VERSIONED MIGRATIONS (potential duplicates)")
    print("=" * 80)
    duplicates = find_duplicates(migrations)

    if duplicates:
        for base, versions in sorted(duplicates.items()):
            print(f"\n{base}:")
            for v in sorted(versions, key=lambda x: x["filename"]):
                print(f"  - {v['filename']} ({v['size']} bytes)")
    else:
        print("\nNo versioned duplicates found.")

    # Size analysis
    print("\n" + "=" * 80)
    print("SIZE ANALYSIS")
    print("=" * 80)
    total_size = sum(m["size"] for m in migrations)
    print(f"Total: {total_size:,} bytes ({total_size / 1024:.1f} KB)")

    largest = sorted(migrations, key=lambda x: x["size"], reverse=True)[:10]
    print("\nLargest migrations:")
    for m in largest:
        print(f"  {m['size']:>8} bytes  {m['filename']}")

    # Consolidation recommendations
    print("\n" + "=" * 80)
    print("CONSOLIDATION PLAN RECOMMENDATIONS")
    print("=" * 80)

    print("\n1. BASELINE SCHEMA (consolidate all CREATE TABLE):")
    schema_files = by_category.get("SCHEMA", [])
    print(f"   Merge {len(schema_files)} files -> 001_schema_and_tables.sql")

    print("\n2. BASELINE INDEXES (consolidate all CREATE INDEX):")
    index_files = by_category.get("INDEX", [])
    print(f"   Merge {len(index_files)} files -> 002_indexes.sql")

    print("\n3. BASELINE VIEWS (keep only latest versions):")
    view_files = by_category.get("VIEW", [])
    print(f"   Merge {len(view_files)} files -> 003_views_and_materialized.sql")

    print("\n4. BASELINE FUNCTIONS:")
    func_files = by_category.get("FUNCTION", [])
    print(f"   Merge {len(func_files)} files -> 004_functions.sql")

    print("\n5. SEED DATA:")
    data_files = by_category.get("DATA", [])
    print(f"   Merge {len(data_files)} files -> 005_seed_data.sql")

    print("\n6. SETTINGS (already in bootstrap):")
    settings_files = by_category.get("SETTINGS", [])
    print(f"   {len(settings_files)} files - MOVE to bootstrap or docker config")

    print("\n" + "=" * 80)
    print("NEXT STEPS:")
    print("=" * 80)
    print("1. Review versioned migrations - keep only latest")
    print("2. Take DB backup before consolidation")
    print("3. Create consolidated baseline files")
    print("4. Test on fresh DB")
    print("5. Update schema_migrations tracking")
    print("6. Archive old migration files")


if __name__ == "__main__":
    main()
