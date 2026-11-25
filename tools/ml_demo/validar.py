#!/usr/bin/env python3
"""Verifica un dataset sintético y sus cortes; no escribe en Supabase."""
from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path

from common import (COHORTS, DATA_FILES, ENROLLMENT_COLUMNS, EVENT_COLUMNS, FEATURE_COLUMNS,
                    SCHEMA_VERSION, SPLITS, on_date, read_csv, sha256)
from preparar import preparar_features


def validar(folder: Path) -> dict:
    """Exige integridad, unicidad y concordancia entre features y eventos previos."""
    manifest = json.loads((folder / "manifest_demo.json").read_text(encoding="utf-8"))
    if (manifest.get("classification") != "SYNTHETIC_DEMO" or
            manifest.get("schema_version") != SCHEMA_VERSION or
            manifest.get("contains_personal_data") is not False or
            manifest.get("uses_supabase") is not False):
        raise ValueError("Manifest DEMO incompatible, omitido o modificado")
    for filename in DATA_FILES:
        if sha256(folder / filename) != manifest["sha256"].get(filename):
            raise ValueError(f"SHA-256 no coincide: {filename}")
    matriculas = read_csv(folder / DATA_FILES[0], ENROLLMENT_COLUMNS)
    eventos = read_csv(folder / DATA_FILES[1], EVENT_COLUMNS)
    features = read_csv(folder / DATA_FILES[2], FEATURE_COLUMNS)
    if any(len(rows) != manifest["row_counts"][filename]
           for filename, rows in zip(DATA_FILES, (matriculas, eventos, features))):
        raise ValueError("Número de filas distinto del manifest")
    keys: dict[tuple[str, str], dict] = {}
    cohort_start: dict[str, str] = {}
    for row in matriculas:
        key = (row["demo_student_id"], row["demo_course_id"])
        if (key in keys or not row["demo_student_id"].startswith("DEMO-S") or
                not row["demo_course_id"].startswith("DEMO-C") or
                row["split"] != SPLITS.get(row["cohort"])):
            raise ValueError("Identidad duplicada o asignación de cohorte inválida")
        start, cutoff, end = (on_date(row[k]) for k in ("start_date", "cutoff_date", "end_date"))
        if not (start < cutoff < end and (end - cutoff).days == 30):
            raise ValueError("Ventana temporal inválida")
        if row["completed_at"] and not (cutoff < on_date(row["completed_at"]) <= end):
            raise ValueError("Etiqueta fuera de la ventana futura")
        cohort_start[row["cohort"]] = row["start_date"]
        keys[key] = row
    ordered = [cohort_start[c] for c in COHORTS]
    if ordered != sorted(set(ordered)):
        raise ValueError("Las cohortes no son cronológicas")
    seen_events = set()
    allowed_types = {"attendance", "session", "content", "submission", "assessment",
                     "progress", "course_completed"}
    for event in eventos:
        key = (event["demo_student_id"], event["demo_course_id"])
        if (key not in keys or event["demo_event_id"] in seen_events or
                event["event_type"] not in allowed_types):
            raise ValueError("Evento desconocido, duplicado o no vinculado")
        seen_events.add(event["demo_event_id"])
        when = on_date(event["event_date"])
        entry = keys[key]
        if not on_date(entry["start_date"]) <= when <= on_date(entry["end_date"]):
            raise ValueError("Evento fuera del curso")
        if event["event_type"] == "assessment" and not (0 <= float(event["score"]) <= float(event["max_score"])):
            raise ValueError("Evaluación fuera del rango")
        if event["event_type"] == "progress" and not 0 <= float(event["completion_ratio"]) <= 1:
            raise ValueError("Progreso inválido")
        if event["event_type"] == "course_completed" and entry["completed_at"] != event["event_date"]:
            raise ValueError("Finalización inconsistente")
    # Comparar todas las features con su cálculo a partir de eventos <= cutoff.
    derived = preparar_features(matriculas, eventos)
    if features != derived:
        raise ValueError("Features alteradas o fuga de información temporal")
    counts = Counter(row["split"] for row in features)
    positives = Counter(row["split"] for row in features if row["target_completion_30d"] == "1")
    if (dict(counts) != manifest["split_counts"] or
            any(positives[split] != manifest["target_positive_counts"][split] for split in counts)):
        raise ValueError("Particiones o etiquetas incorrectas")
    if set(counts) != {"train", "validation", "test"}:
        raise ValueError("Falta una partición de evaluación")
    return {"valid": True, "dataset": "SYNTHETIC_DEMO", "matriculas": len(matriculas),
            "eventos": len(eventos), "features": len(features), "particiones": dict(counts),
            "positivos": dict(positives), "sin_fuga_temporal": True,
            "sha256_validos": True}


def main() -> None:
    parser = argparse.ArgumentParser(description="Validar dataset académico DEMO")
    parser.add_argument("--carpeta", type=Path, default=Path("../edumaster_datos_demo"))
    args = parser.parse_args()
    report = validar(args.carpeta)
    print(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
