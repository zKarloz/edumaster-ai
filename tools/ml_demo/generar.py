#!/usr/bin/env python3
"""Crea matrículas y eventos DEMO sin usuarios Auth ni escritura de base de datos.

Uso (raíz del repositorio):
    python tools/ml_demo/generar.py --estudiantes 500 --meses 6 --semilla 42 \
        --salida ../edumaster_datos_demo
"""
from __future__ import annotations

import argparse
import math
import random
from datetime import date
from pathlib import Path

from common import (COHORTS, DATA_FILES, ENROLLMENT_COLUMNS, EVENT_COLUMNS, FEATURE_COLUMNS, SCHEMA_VERSION,
                    SPLITS, add_days, iso, sha256, write_csv, write_json)
from preparar import preparar_features


def clamp(value: float, lower: float, upper: float) -> float:
    return max(lower, min(upper, value))


def sigmoid(value: float) -> float:
    return 1 / (1 + math.exp(-clamp(value, -20, 20)))


def build_data(n_students: int, months: int, seed: int) -> tuple[list[dict], list[dict]]:
    """Emite historiales longitudinales correlacionados sin etiquetas deterministas.

    La finalización se decide con una probabilidad dependiente de variables
    latentes y ruido; no se usa ninguna regla simple tipo «nota < 11».
    """
    rng = random.Random(seed)
    enrollments: list[dict] = []
    events: list[dict] = []
    duration = months * 30
    event_number = 0
    # Cohortes sucesivas, sin solapamiento: tres de train y dos posteriores.
    first_start = date(2019, 1, 7)
    for index in range(n_students):
        cohort = COHORTS[min(4, index * len(COHORTS) // n_students)]
        cohort_index = COHORTS.index(cohort)
        start = add_days(first_start, cohort_index * (duration + 28))
        end = add_days(start, duration)
        cutoff = add_days(end, -30)
        student = f"DEMO-S{index + 1:06d}"
        level = ("basico", "intermedio", "avanzado")[(index + cohort_index) % 3]
        course = f"DEMO-C{cohort_index + 1:02d}"
        ability = rng.gauss(0, 1)
        engagement = rng.gauss(0, 1)
        attendance_bias = clamp(sigmoid(0.9 + engagement * 0.9), 0.08, 0.98)
        completion_probability = clamp(sigmoid(0.20 + engagement * 1.0 + ability * 0.48), 0.04, 0.96)
        completed = rng.random() < completion_probability
        # La etiqueta ocurre después del corte de observación.
        completed_at = iso(add_days(end, -rng.randint(0, 27))) if completed else ""
        enrollments.append({
            "demo_student_id": student, "demo_course_id": course, "cohort": cohort,
            "split": SPLITS[cohort], "course_level": level,
            "start_date": iso(start), "cutoff_date": iso(cutoff), "end_date": iso(end),
            "completed_at": completed_at,
        })

        def record(day: date, event_type: str, *, score: str = "", max_score: str = "",
                   attendance: str = "", late: str = "", progress: str = "") -> None:
            nonlocal event_number
            event_number += 1
            events.append({"demo_event_id": f"DEMO-E{event_number:09d}",
                           "demo_student_id": student, "demo_course_id": course,
                           "event_date": iso(day), "event_type": event_type,
                           "score": score, "max_score": max_score,
                           "attendance_status": attendance, "late": late,
                           "completion_ratio": progress})

        # Observaciones semanales hasta el final; el pipeline filtra las futuras.
        for week in range((duration // 7) + 1):
            day = add_days(start, min(week * 7, duration - 1))
            present_probability = clamp(attendance_bias + rng.gauss(0, 0.035), 0.05, 0.99)
            if rng.random() < present_probability:
                record(day, "attendance", attendance="late" if rng.random() < 0.13 else "present")
            else:
                record(day, "attendance", attendance="excused" if rng.random() < 0.08 else "absent")
            for offset in (1, 3, 5):
                session_day = add_days(day, offset)
                if session_day >= end:
                    continue
                if rng.random() < clamp(0.56 + engagement * 0.19, 0.06, 0.98):
                    record(session_day, "session")
                    if rng.random() < 0.75:
                        record(session_day, "content")
            if week % 2 == 0:
                # Existen entregas tardías y evaluaciones con puntajes separados.
                submitted = rng.random() < clamp(0.78 + engagement * 0.12, 0.10, 0.99)
                if submitted:
                    is_late = rng.random() < clamp(0.17 - engagement * 0.07, 0.01, 0.75)
                    record(day, "submission", late="1" if is_late else "0")
                    normalized = clamp(0.65 + ability * 0.15 + engagement * 0.08 +
                                       rng.gauss(0, 0.16), 0, 1)
                    record(day, "assessment", score=f"{normalized * 20:.2f}", max_score="20.00")
            if week % 2 == 1:
                # El progreso observado es ruidoso; no equivale a la etiqueta futura.
                portion = min(1, week * 7 / duration)
                progression = clamp(portion * (0.7 + engagement * 0.15) + rng.gauss(0, 0.04), 0, 1)
                record(day, "progress", progress=f"{progression:.4f}")
        if completed:
            # Evento posterior al corte, deliberado para probar prevención de fuga.
            record(date.fromisoformat(completed_at), "course_completed")
    return enrollments, events


def generar(salida: Path, n_students: int = 500, months: int = 6, seed: int = 42,
            overwrite: bool = False) -> dict:
    """No borra archivos ajenos; exige confirmación explícita para repetir."""
    if not (50 <= n_students <= 5000):
        raise ValueError("--estudiantes debe estar entre 50 y 5000")
    if months not in (3, 6, 12):
        raise ValueError("--meses debe ser 3, 6 o 12")
    if not (0 <= seed <= 2_147_483_647):
        raise ValueError("--semilla fuera del rango permitido")
    salida = salida.expanduser().resolve()
    if salida.exists():
        existing = [p for p in (list(DATA_FILES) + ["manifest_demo.json"]) if (salida / p).exists()]
        if existing and not overwrite:
            raise ValueError("La salida contiene datos DEMO; usa --sobrescribir para reemplazarlos")
        if not salida.is_dir():
            raise ValueError("La salida no es una carpeta")
    else:
        salida.mkdir(parents=True)
    enrollments, events = build_data(n_students, months, seed)
    # Una nueva generación invalida cualquier entrenamiento anterior de esa carpeta.
    if overwrite:
        (salida / "baseline_resultados_demo.json").unlink(missing_ok=True)
        (salida / "features_recalculadas_demo.csv").unlink(missing_ok=True)
    write_csv(salida / DATA_FILES[0], ENROLLMENT_COLUMNS, enrollments)
    write_csv(salida / DATA_FILES[1], EVENT_COLUMNS, events)
    features = preparar_features(enrollments, events)
    write_csv(salida / DATA_FILES[2], FEATURE_COLUMNS, features)
    counts = {split: sum(item["split"] == split for item in enrollments)
              for split in ("train", "validation", "test")}
    positives = {split: sum(item["split"] == split and bool(item["completed_at"])
                           for item in enrollments) for split in counts}
    manifest = {
        "schema_version": SCHEMA_VERSION, "classification": "SYNTHETIC_DEMO",
        "educational_validity": "NO_VALIDADO", "contains_personal_data": False,
        "uses_supabase": False, "seed": seed, "students": n_students, "months": months,
        "prediction_horizon_days": 30, "feature_cutoff": "end_date - 30 days",
        "training_split_policy": "cohortes cronologicas 1-3 / 4 / 5",
        "row_counts": {"matriculas_demo.csv": len(enrollments),
                       "eventos_demo.csv": len(events), "features_demo.csv": len(features)},
        "split_counts": counts, "target_positive_counts": positives,
        "sha256": {name: sha256(salida / name) for name in DATA_FILES},
    }
    write_json(salida / "manifest_demo.json", manifest)
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser(description="Generar dataset académico sintético DEMO")
    parser.add_argument("--estudiantes", type=int, default=500)
    parser.add_argument("--meses", type=int, choices=(3, 6, 12), default=6)
    parser.add_argument("--semilla", type=int, default=42)
    parser.add_argument("--salida", type=Path, default=Path("../edumaster_datos_demo"))
    parser.add_argument("--sobrescribir", action="store_true")
    args = parser.parse_args()
    result = generar(args.salida, args.estudiantes, args.meses, args.semilla, args.sobrescribir)
    print(f"DEMO generado: {result['students']} matrículas y {result['row_counts']['eventos_demo.csv']} eventos")
    print(f"Partición temporal: {result['split_counts']}")
    print(f"Salida: {args.salida.resolve()} (sin Supabase ni correos)")


if __name__ == "__main__":
    main()
