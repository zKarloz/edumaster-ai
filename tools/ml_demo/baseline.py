#!/usr/bin/env python3
"""Baseline de regresión logística DEMO (solo biblioteca estándar).

No entrena una red neuronal, no accede a la API y no publica predicciones.
La normalización se ajusta EXCLUSIVAMENTE con train.
"""
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

from common import FEATURE_COLUMNS, read_csv, sha256, write_json
from validar import validar

NUMERIC = ("active_days_14d", "sessions_14d", "completion_ratio", "assessment_mean",
           "has_assessments", "assessment_trend", "late_submissions_30d",
           "content_engagement", "skill_evidence_score", "days_since_last_activity")
LEVELS = ("basico", "intermedio", "avanzado")
MODEL_INPUT = NUMERIC + tuple(f"level_{value}" for value in LEVELS)


def sigmoid(x: float) -> float:
    """Evita overflow con puntuaciones extremas."""
    if x >= 0:
        v = math.exp(-x)
        return 1 / (1 + v)
    v = math.exp(x)
    return v / (1 + v)


def features(row: dict) -> list[float]:
    if row["course_level"] not in LEVELS:
        raise ValueError("Nivel desconocido")
    return [float(row[name]) for name in NUMERIC] + [float(row["course_level"] == name) for name in LEVELS]


def calculate_scaler(train: list[list[float]]) -> tuple[list[float], list[float]]:
    """El conjunto de prueba NUNCA participa en la estadística de escala."""
    mean = [sum(row[j] for row in train) / len(train) for j in range(len(MODEL_INPUT))]
    scale = [(sum((row[j] - mean[j]) ** 2 for row in train) / len(train)) ** 0.5
             for j in range(len(MODEL_INPUT))]
    return mean, [v if v > 1e-9 else 1.0 for v in scale]


def transform(matrix: list[list[float]], mean: list[float], scale: list[float]) -> list[list[float]]:
    return [[(value - mean[j]) / scale[j] for j, value in enumerate(row)] for row in matrix]


def probabilities(x: list[list[float]], weights: list[float], bias: float) -> list[float]:
    return [sigmoid(bias + sum(w * v for w, v in zip(weights, row))) for row in x]


def log_loss(y: list[int], p: list[float]) -> float:
    return -sum(yi * math.log(max(1e-12, pi)) +
                (1 - yi) * math.log(max(1e-12, 1 - pi))
                for yi, pi in zip(y, p)) / len(y)


def roc_auc(y: list[int], p: list[float]) -> float | None:
    """AUC por estadístico de rangos, corrigiendo empates."""
    n_positive = sum(y)
    n_negative = len(y) - n_positive
    if not n_positive or not n_negative:
        return None
    ranking = sorted(zip(p, y))
    rank_sum = 0.0
    pos = 0
    while pos < len(ranking):
        end = pos + 1
        while end < len(ranking) and ranking[end][0] == ranking[pos][0]:
            end += 1
        average_rank = (pos + 1 + end) / 2
        rank_sum += sum(yi for _, yi in ranking[pos:end]) * average_rank
        pos = end
    return (rank_sum - n_positive * (n_positive + 1) / 2) / (n_positive * n_negative)


def metrics(y: list[int], p: list[float]) -> dict:
    tp = sum(a == 1 and b >= 0.5 for a, b in zip(y, p))
    fp = sum(a == 0 and b >= 0.5 for a, b in zip(y, p))
    fn = sum(a == 1 and b < 0.5 for a, b in zip(y, p))
    tn = len(y) - tp - fp - fn
    precision = tp / (tp + fp) if tp + fp else 0
    recall = tp / (tp + fn) if tp + fn else 0
    return {"rows": len(y), "positives": sum(y), "roc_auc": roc_auc(y, p),
            "brier": sum((a - b) ** 2 for a, b in zip(y, p)) / len(y),
            "log_loss": log_loss(y, p), "f1": 2 * precision * recall / (precision + recall)
            if precision + recall else 0, "precision": precision, "recall": recall,
            "tp": tp, "tn": tn, "fp": fp, "fn": fn}


def train(folder: Path, *, epochs: int = 700, learning_rate: float = 0.18) -> dict:
    """Entrena con train; selecciona época usando validation; test se evalúa una vez."""
    validar(folder)  # Comprueba manifiesto, checksums y fuga temporal antes de usar datos.
    entries = read_csv(folder / "features_demo.csv", FEATURE_COLUMNS)
    matrix = {split: [features(row) for row in entries if row["split"] == split]
              for split in ("train", "validation", "test")}
    target = {split: [int(row["target_completion_30d"]) for row in entries if row["split"] == split]
              for split in matrix}
    if any(len(matrix[part]) < 5 for part in matrix):
        raise ValueError("Son necesarias al menos cinco observaciones por partición")
    mean, scale = calculate_scaler(matrix["train"])
    scaled = {part: transform(matrix[part], mean, scale) for part in matrix}
    weights = [0.0] * len(MODEL_INPUT)
    bias = 0.0
    best = (float("inf"), weights.copy(), bias, 0)
    patience = 100
    # Optimización determinista por gradiente de lote completo y L2 moderado.
    for epoch in range(1, epochs + 1):
        probs = probabilities(scaled["train"], weights, bias)
        errors = [prediction - actual for prediction, actual in zip(probs, target["train"])]
        count = len(errors)
        grads = [sum(err * row[j] for err, row in zip(errors, scaled["train"])) / count +
                 0.002 * weights[j] for j in range(len(weights))]
        grad_bias = sum(errors) / count
        weights = [value - learning_rate * grad for value, grad in zip(weights, grads)]
        bias -= learning_rate * grad_bias
        valid_loss = log_loss(target["validation"], probabilities(scaled["validation"], weights, bias))
        if valid_loss < best[0] - 1e-7:
            best = (valid_loss, weights.copy(), bias, epoch)
        if epoch - best[3] >= patience:
            break
    _, weights, bias, chosen_epoch = best
    evaluation = {part: metrics(target[part], probabilities(scaled[part], weights, bias))
                  for part in ("train", "validation", "test")}
    output = {
        "classification": "SYNTHETIC_DEMO", "educational_validity": "NO_VALIDADO",
        "model_type": "logistic_regression_baseline", "model_version": "1.0.0-DEMO",
        "target": "target_completion_30d", "threshold": 0.5,
        "selection": "epoch_by_validation_log_loss; test_never_used_for_training",
        "selected_epoch": chosen_epoch, "max_epochs": epochs,
        "dataset_feature_sha256": sha256(folder / "features_demo.csv"),
        "input_columns": list(MODEL_INPUT), "train_scaler_mean": mean,
        "train_scaler_scale": scale, "weights": weights, "bias": bias,
        "metrics": evaluation,
        "disclaimer": "DATOS SINTETICOS: métricas no válidas para decisiones educativas reales",
    }
    write_json(folder / "baseline_resultados_demo.json", output)
    return output


def main() -> None:
    parser = argparse.ArgumentParser(description="Entrenar baseline DEMO con cortes temporales")
    parser.add_argument("--carpeta", type=Path, default=Path("../edumaster_datos_demo"))
    args = parser.parse_args()
    results = train(args.carpeta)
    print(json.dumps({"clasificacion": results["classification"],
                      "modelo": results["model_type"],
                      "epoca": results["selected_epoch"],
                      "metricas": results["metrics"]}, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
