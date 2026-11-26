"""Validación de contrato y permisos sin una conexión a producción."""
import json
import unittest

from app.routers.neural_demo import COLUMNS, HASH, fixture, validate_checkpoint


def example():
    f=fixture()
    return {'version': 1, 'classification': 'SYNTHETIC DEMO', 'savedAt': '2026-11-26T00:00:00Z', 'backend': 'cpu', 'scaler': {'mean': [0]*13, 'scale': [1]*13}, 'history': [{'type': 'epoch', 'epoch': 1, 'loss': .7, 'validationLoss': .7, 'bestEpoch': 1, 'staleEpochs': 0}], 'result': {'type': 'done', 'epoch': 1, 'completedEpochs': 1, 'stopReason': 'maxEpochs', 'metrics': {'accuracy': .5, 'f1': .5, 'roc_auc': .5, 'brier': .25, 'log_loss': .7}, 'baseline': f['baseline'], 'columns': COLUMNS, 'samples': [{'raw': x, 'actual': y, 'normalized': x, 'prediction': .5, 'activations': [[0]*8,[0]*4,[.5]]} for x,y in zip(f['test']['x'],f['test']['y'])], 'weights': [{'input': n, 'output': m, 'kernel': [0]*(n*m), 'bias': [0]*m} for n,m in [(13,8),(8,4),(4,1)]], 'confusion': {'tp': 22, 'tn': 0, 'fp': 28, 'fn': 0}, 'elapsedMs': 10, 'tensorBytes': 100, 'config': {'epochs': 1, 'batchSize': 16, 'learningRate': .01, 'patience': 1, 'seed': 42, 'earlyStopping': False}, 'datasetHash': HASH}}

class NeuralRegistryTests(unittest.TestCase):
    def test_contract(self):
        self.assertEqual(validate_checkpoint(json.dumps(example()).encode()).result.epoch,1)
    def test_reject_unknown_and_real_samples(self):
        for change in ('unknown','sample','weight','hash'):
            d=json.loads(json.dumps(example()))
            if change=='unknown': d['student']='private'
            if change=='sample': d['result']['samples'][0]['raw'][0]+=1
            if change=='weight': d['result']['weights'][0]['kernel'].pop()
            if change=='hash': d['result']['datasetHash']='x'*64
            with self.assertRaises(ValueError): validate_checkpoint(json.dumps(d).encode())

    def test_anonymous_endpoints(self):
        from fastapi.testclient import TestClient

        from app.main import app
        client=TestClient(app)
        base='/api/v1/neural-demo/models'
        ident='11111111-1111-4111-8111-111111111111'
        for method,path in [('GET',base),('POST',base),('GET',f'{base}/{ident}'),('PATCH',f'{base}/{ident}/archive')]:
            self.assertEqual(client.request(method,path).status_code,401)
