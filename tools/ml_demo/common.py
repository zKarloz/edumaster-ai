"""Contratos compartidos del laboratorio académico sintético EduMaster (DEMO).

No contiene conectores a Supabase ni procesa identificadores personales reales.
"""
from __future__ import annotations

import csv
import hashlib
import json
from datetime import date, timedelta
from pathlib import Path

SCHEMA_VERSION = "1.0.0-DEMO"
COHORTS = ("COH-01", "COH-02", "COH-03", "COH-04", "COH-05")
SPLITS = {"COH-01": "train", "COH-02": "train", "COH-03": "train",
          "COH-04": "validation", "COH-05": "test"}
ENROLLMENT_COLUMNS = ("demo_student_id", "demo_course_id", "cohort", "split",
                      "course_level", "start_date", "cutoff_date", "end_date", "completed_at")
EVENT_COLUMNS = ("demo_event_id", "demo_student_id", "demo_course_id", "event_date",
                 "event_type", "score", "max_score", "attendance_status", "late",
                 "completion_ratio")
FEATURE_COLUMNS = ("demo_student_id", "demo_course_id", "cohort", "split", "course_level",
                   "cutoff_date", "active_days_14d", "sessions_14d", "completion_ratio",
                   "assessment_mean", "has_assessments", "assessment_trend",
                   "late_submissions_30d", "content_engagement", "skill_evidence_score",
                   "days_since_last_activity", "target_completion_30d")
DATA_FILES = ("matriculas_demo.csv", "eventos_demo.csv", "features_demo.csv")
FORBIDDEN_COLUMNS = {"email", "correo", "full_name", "nombre_completo", "dni",
                     "password", "phone", "telefono", "ip", "auth_user_id"}


def iso(value: date) -> str:
    """Representación estable para columnas de fecha."""
    return value.isoformat()


def on_date(text_value: str) -> date:
    """Analiza una fecha ISO estricta sin considerar husos horarios."""
    return date.fromisoformat(text_value)


def add_days(value: date, days: int) -> date:
    return value + timedelta(days=days)


def write_csv(path: Path, columns: tuple[str, ...], rows: list[dict]) -> None:
    """Escribe CSV reproducible con saltos LF, sin macros ni fórmulas."""
    with path.open("w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=columns, lineterminator="\n", extrasaction="raise")
        writer.writeheader()
        writer.writerows(rows)


def read_csv(path: Path, columns: tuple[str, ...]) -> list[dict]:
    """Rechaza cambios de contrato e IDs/columnas adicionales."""
    with path.open("r", encoding="utf-8", newline="") as stream:
        reader = csv.DictReader(stream)
        if tuple(reader.fieldnames or ()) != columns:
            raise ValueError(f"Esquema inesperado en {path.name}: {reader.fieldnames}")
        if FORBIDDEN_COLUMNS.intersection(reader.fieldnames or ()):
            raise ValueError("El dataset no puede incluir identificadores directos")
        return list(reader)


def sha256(path: Path) -> str:
    """Huella criptográfica para versionar archivos y detectar ediciones."""
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_json(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False, sort_keys=True) + "\n", encoding="utf-8")
