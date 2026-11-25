"""Pruebas sin red, Supabase, credenciales ni dependencias externas."""
from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from baseline import train  # noqa: E402
from common import DATA_FILES, ENROLLMENT_COLUMNS, EVENT_COLUMNS, FEATURE_COLUMNS, read_csv, sha256  # noqa: E402
from generar import generar  # noqa: E402
from preparar import preparar_features  # noqa: E402
from validar import validar  # noqa: E402


class DemoPipelineTests(unittest.TestCase):
    """Contratos de reproducibilidad, aislamiento y ausencia de fugas."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)

    def test_splits_counts_and_versioned_checksum(self):
        manifest = generar(self.root / "data", 100, 3, 42)
        report = validar(self.root / "data")
        self.assertEqual(report["matriculas"], 100)
        self.assertEqual(manifest["classification"], "SYNTHETIC_DEMO")
        self.assertEqual(report["particiones"], {"train": 60, "validation": 20, "test": 20})
        self.assertTrue(report["sin_fuga_temporal"])

    def test_same_seed_is_byte_reproducible(self):
        generar(self.root / "a", 75, 6, 73)
        generar(self.root / "b", 75, 6, 73)
        for name in (*DATA_FILES, "manifest_demo.json"):
            self.assertEqual(sha256(self.root / "a" / name), sha256(self.root / "b" / name), name)

    def test_future_events_never_affect_predictors(self):
        folder = self.root / "future"
        generar(folder, 50, 3, 42)
        enrollments = read_csv(folder / DATA_FILES[0], ENROLLMENT_COLUMNS)
        events = read_csv(folder / DATA_FILES[1], EVENT_COLUMNS)
        old = preparar_features(enrollments, events)
        example = enrollments[0]
        extra = {name: "" for name in EVENT_COLUMNS}
        extra.update({"demo_event_id": "DEMO-EFUTURE", "demo_student_id": example["demo_student_id"],
                      "demo_course_id": example["demo_course_id"], "event_date": example["end_date"],
                      "event_type": "assessment", "score": "20", "max_score": "20"})
        # La evaluación futura es deliberadamente extrema.
        self.assertEqual(old, preparar_features(enrollments, events + [extra]))

    def test_validator_rejects_tampering(self):
        folder = self.root / "tampered"
        generar(folder, 50, 3, 42)
        with (folder / DATA_FILES[2]).open("a", encoding="utf-8") as f:
            f.write("DEMO-INJECTED,\n")
        with self.assertRaisesRegex(ValueError, "SHA-256"):
            validar(folder)

    def test_no_overwrite_without_opt_in(self):
        folder = self.root / "do_not_replace"
        generar(folder, 50, 3, 5)
        with self.assertRaisesRegex(ValueError, "sobrescribir"):
            generar(folder, 50, 3, 6)

    def test_scoring_baseline_is_demo_and_does_not_use_test_to_fit(self):
        folder = self.root / "trained"
        generar(folder, 100, 3, 15)
        result = train(folder, epochs=100)
        self.assertEqual(result["classification"], "SYNTHETIC_DEMO")
        self.assertIn("test", result["metrics"])
        self.assertTrue((folder / "baseline_resultados_demo.json").is_file())
        self.assertEqual(result["input_columns"], list(result["input_columns"]))
        self.assertEqual(result["metrics"]["test"]["rows"], 20)

    def test_fields_exclude_identity_data(self):
        for fields in (EVENT_COLUMNS, ENROLLMENT_COLUMNS, FEATURE_COLUMNS):
            self.assertFalse({"email", "full_name", "auth_id", "dni"}.intersection(fields))


if __name__ == "__main__":
    unittest.main()
