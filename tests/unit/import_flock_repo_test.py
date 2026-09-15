import importlib.util
import unittest
from decimal import Decimal
from pathlib import Path


MODULE_PATH = Path(__file__).parents[2] / "scripts" / "import_flock_repo.py"
SPEC = importlib.util.spec_from_file_location("import_flock_repo", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(MODULE)


class ImportFlockRepoTests(unittest.TestCase):
    def test_promoted_fields_use_declared_precedence_and_keep_raw_properties(self):
        props = {
            "id": 123,
            "ref": "fallback-ref",
            "camera:type": "fixed",
            "surveillance:type": "ALPR",
            "addr:city": "Primary City",
            "city": "Fallback City",
            "addr:state": "MI",
            "operator": "Primary Operator",
            "direction": "270",
            "camera:direction": "90",
            "camera:mount": "pole",
            "manufacturer:wikidata": "Q108485435",
            "website": "https://example.test",
        }

        metadata = MODULE.extract_metadata(props)

        self.assertEqual(metadata["source_id"], "123")
        self.assertEqual(metadata["camera_type"], "fixed")
        self.assertEqual(metadata["city"], "Primary City")
        self.assertEqual(metadata["state"], "MI")
        self.assertEqual(metadata["direction"], "270")
        self.assertEqual(metadata["camera_mount"], "pole")
        self.assertEqual(metadata["manufacturer_wikidata"], "Q108485435")
        self.assertEqual(metadata["source_properties"], props)

    def test_build_rows_merges_exact_duplicates_without_losing_metadata(self):
        features = [
            {
                "geometry": {
                    "type": "Point",
                    "coordinates": [Decimal("-83.3528975"), Decimal("42.2096815")],
                },
                "properties": {"id": 1, "name": "first", "manufacturer": "Flock Safety"},
            },
            {
                "geometry": {
                    "type": "Point",
                    "coordinates": [Decimal("-83.3528975"), Decimal("42.2096815")],
                },
                "properties": {"id": 2, "direction": "270"},
            },
            {"geometry": {"type": "LineString", "coordinates": []}, "properties": {}},
        ]

        rows, stats = MODULE.build_rows(features)

        self.assertEqual(stats["skipped"], 1)
        self.assertEqual(stats["duplicate_coordinates"], 1)
        self.assertEqual(stats["merged_groups"], 1)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["lat"], Decimal("42.2096815"))
        self.assertEqual(rows[0]["lon"], Decimal("-83.3528975"))
        self.assertEqual(rows[0]["name"], "first")
        self.assertEqual(rows[0]["manufacturer"], "Flock Safety")
        self.assertEqual(rows[0]["direction"], "270")

    def test_duplicate_conflicts_use_first_non_empty_value(self):
        features = [
            {
                "geometry": {"type": "Point", "coordinates": [Decimal("1.0"), Decimal("2.0")]},
                "properties": {"id": 1, "operator": "first"},
            },
            {
                "geometry": {"type": "Point", "coordinates": [Decimal("1.0"), Decimal("2.0")]},
                "properties": {"id": 2, "operator": "second"},
            },
        ]

        rows, _ = MODULE.build_rows(features)

        self.assertEqual(rows[0]["operator"], "first")
        self.assertEqual(rows[0]["source_properties"]["operator"], "first")

    def test_similar_but_not_equal_coordinates_are_not_merged(self):
        features = [
            {
                "geometry": {
                    "type": "Point",
                    "coordinates": [Decimal("1.0000001"), Decimal("2.0000001")],
                },
                "properties": {"id": 1, "name": "first"},
            },
            {
                "geometry": {
                    "type": "Point",
                    "coordinates": [Decimal("1.0000002"), Decimal("2.0000002")],
                },
                "properties": {"id": 2, "name": "second"},
            },
        ]

        rows, stats = MODULE.build_rows(features)

        self.assertEqual(len(rows), 2)
        self.assertEqual(stats["duplicate_coordinates"], 0)
        self.assertEqual(stats["merged_groups"], 0)

    def test_decimal_json_serialization_keeps_numbers_unquoted(self):
        encoded = MODULE.json_dumps_preserving_decimals({"value": Decimal("42.2096815")})
        self.assertEqual(encoded, '{"value":42.2096815}')

    def test_stale_delete_is_scoped_to_flock_source(self):
        class Cursor:
            rowcount = 3

            def __init__(self):
                self.sql = ""
                self.params = None

            def execute(self, sql, params):
                self.sql = sql
                self.params = params

        cursor = Cursor()
        deleted = MODULE.delete_stale_rows(cursor)

        self.assertEqual(deleted, 3)
        self.assertIn("dc.source = %s", cursor.sql)
        self.assertEqual(cursor.params, ("FLOCK_REPO",))


if __name__ == "__main__":
    unittest.main()
