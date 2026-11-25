#!/usr/bin/env python3
"""Construcción temporal de características DEMO, independiente del generador.

Las variables solo usan eventos anteriores o iguales a cutoff_date. El resultado
posterior a ese corte aparece exclusivamente en la columna objetivo.
"""
from __future__ import annotations

import argparse
from collections import defaultdict
from datetime import timedelta
from pathlib import Path

from common import (ENROLLMENT_COLUMNS, EVENT_COLUMNS, FEATURE_COLUMNS, on_date,
                    read_csv, write_csv)


def _number(value: float, decimals: int = 4) -> str:
    return f"{value:.{decimals}f}"


def preparar_features(enrollments: list[dict], events: list[dict]) -> list[dict]:
    """Reconstruye características desde eventos, respetando fechas de corte."""
    by_enrollment: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for event in events:
        by_enrollment[event["demo_student_id"], event["demo_course_id"]].append(event)
    result = []
    for enrollment in enrollments:
        cutoff = on_date(enrollment["cutoff_date"])
        start = on_date(enrollment["start_date"])
        key = (enrollment["demo_student_id"], enrollment["demo_course_id"])
        # Ningún evento posterior puede intervenir en las variables predictoras.
        observed = sorted((event for event in by_enrollment[key]
                           if start <= on_date(event["event_date"]) <= cutoff
                           and event["event_type"] != "course_completed"),
                          key=lambda x: (x["event_date"], x["demo_event_id"]))
        last14 = cutoff - timedelta(days=13)
        last30 = cutoff - timedelta(days=29)
        assessments = [float(e["score"]) / float(e["max_score"])
                       for e in observed if e["event_type"] == "assessment"
                       and e["max_score"] and float(e["max_score"]) > 0]
        progress = [float(e["completion_ratio"]) for e in observed
                    if e["event_type"] == "progress" and e["completion_ratio"]]
        days_active = {e["event_date"] for e in observed if on_date(e["event_date"]) >= last14}
        days_since = (cutoff - on_date(observed[-1]["event_date"])).days if observed else 180
        completed = enrollment["completed_at"]
        target = bool(completed and cutoff < on_date(completed) <= cutoff + timedelta(days=30))
        avg = sum(assessments) / len(assessments) if assessments else 0.0
        trend = assessments[-1] - assessments[0] if len(assessments) > 1 else 0.0
        result.append({
            "demo_student_id": enrollment["demo_student_id"],
            "demo_course_id": enrollment["demo_course_id"],
            "cohort": enrollment["cohort"], "split": enrollment["split"],
            "course_level": enrollment["course_level"], "cutoff_date": enrollment["cutoff_date"],
            "active_days_14d": str(len(days_active)),
            "sessions_14d": str(sum(e["event_type"] == "session" and
                                    on_date(e["event_date"]) >= last14 for e in observed)),
            "completion_ratio": _number(progress[-1] if progress else 0.0),
            "assessment_mean": _number(avg),
            "has_assessments": str(int(bool(assessments))),
            "assessment_trend": _number(trend),
            "late_submissions_30d": str(sum(e["event_type"] == "submission" and
                                             e["late"] == "1" and
                                             on_date(e["event_date"]) >= last30 for e in observed)),
            "content_engagement": str(sum(e["event_type"] == "content" and
                                           on_date(e["event_date"]) >= last30 for e in observed)),
            "skill_evidence_score": _number(avg),  # DEMO: nota, no dominio validado por rúbrica.
            "days_since_last_activity": str(days_since),
            "target_completion_30d": str(int(target)),
        })
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description="Reconstruir features DEMO respetando cutoff")
    parser.add_argument("--carpeta", type=Path, default=Path("../edumaster_datos_demo"))
    args = parser.parse_args()
    folder = args.carpeta
    enrollment = read_csv(folder / "matriculas_demo.csv", ENROLLMENT_COLUMNS)
    events = read_csv(folder / "eventos_demo.csv", EVENT_COLUMNS)
    result = preparar_features(enrollment, events)
    # No modifica los archivos de la versión existente: la regeneración completa
    # y de checksums debe efectuarse con generar.py --sobrescribir.
    write_csv(folder / "features_recalculadas_demo.csv", FEATURE_COLUMNS, result)
    print(f"Características recalculadas: {len(result)} (archivo de comparación sin alterar manifest)")


if __name__ == "__main__":
    main()
