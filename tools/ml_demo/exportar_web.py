"""Exporta únicamente matrices sintéticas verificadas, sin identificadores."""
import argparse
from pathlib import Path
from baseline import features, MODEL_INPUT, train
from common import read_csv, FEATURE_COLUMNS, write_json

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--carpeta', type=Path, required=True)
    parser.add_argument('--salida', type=Path, required=True)
    args = parser.parse_args()
    baseline = train(args.carpeta)  # Valida manifiesto y particiones antes de exportar.
    rows = read_csv(args.carpeta / 'features_demo.csv', FEATURE_COLUMNS)
    write_json(args.salida, {'classification': 'SYNTHETIC_DEMO', 'columns': list(MODEL_INPUT),
        'sha256': baseline['dataset_feature_sha256'], 'baseline': baseline['metrics']['test'],
        'splits': {part: {'x': [features(r) for r in rows if r['split'] == part],
                          'y': [int(r['target_completion_30d']) for r in rows if r['split'] == part]}
                   for part in ('train', 'validation', 'test')}})
