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

    def test_build_rows_preserves_decimal_coordinates_and_collapses_exact_duplicates(self):
        features = [
            {
                "geometry": {
                    "type": "Point",
                    "coordinates": [Decimal("-83.3528975"), Decimal("42.2096815")],
                },
                "properties": {"id": 1, "name": "first"},
            },
            {
                "geometry": {
                    "type": "Point",
                    "coordinates": [Decimal("-83.3528975"), Decimal("42.2096815")],
                },
                "properties": {"id": 2, "name": "last"},
            },
            {"geometry": {"type": "LineString", "coordinates": []}, "properties": {}},
        ]

        rows, skipped, duplicates = MODULE.build_rows(features)

        self.assertEqual(skipped, 1)
        self.assertEqual(duplicates, 1)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["lat"], Decimal("42.2096815"))
        self.assertEqual(rows[0]["lon"], Decimal("-83.3528975"))
        self.assertEqual(rows[0]["name"], "last")

    def test_decimal_json_serialization_keeps_numbers_unquoted(self):
        encoded = MODULE.json_dumps_preserving_decimals({"value": Decimal("42.2096815")})
        self.assertEqual(encoded, '{"value":42.2096815}')


if __name__ == "__main__":
    unittest.main()
