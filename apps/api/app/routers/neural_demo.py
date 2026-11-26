"""Registro global de experimentos sintéticos no verificados, solo superadmin."""
import json
from functools import lru_cache
from pathlib import Path
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field, ValidationError
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

from app.core.database import require_engine
from app.core.security import authenticated_user_id
from app.routers.organizations import _require_superadmin

router = APIRouter(prefix='/api/v1/neural-demo/models', tags=['neural-demo'])
HASH = '51488b0323fb1e3421eb25e9e518711aacd8a3bc1a5fe53eb91f91b94a47b1e6'
COLUMNS = ['active_days_14d','sessions_14d','completion_ratio','assessment_mean','has_assessments','assessment_trend','late_submissions_30d','content_engagement','skill_evidence_score','days_since_last_activity','level_basico','level_intermedio','level_avanzado']

class Strict(BaseModel):
    model_config = ConfigDict(extra='forbid', allow_inf_nan=False, strict=True)
class Config(Strict):
    epochs: int = Field(ge=1,le=200)
    batchSize: Literal[8,16,32,64]
    learningRate: float = Field(ge=.0001,le=.05)
    patience: int = Field(ge=1,le=200)
    seed: int = Field(ge=0,le=1000000)
    earlyStopping: bool
class Epoch(Strict):
    type: Literal['epoch']
    epoch: int
    loss: float = Field(ge=0)
    validationLoss: float = Field(ge=0)
    bestEpoch: int
    staleEpochs: int
class Metrics(Strict):
    f1: float = Field(ge=0,le=1)
    roc_auc: float | None = Field(ge=0,le=1)
    brier: float = Field(ge=0,le=1)
    log_loss: float = Field(ge=0)
class NetworkMetrics(Metrics):
    accuracy: float = Field(ge=0,le=1)
class Confusion(Strict):
    tp: int = Field(ge=0,le=50)
    tn: int = Field(ge=0,le=50)
    fp: int = Field(ge=0,le=50)
    fn: int = Field(ge=0,le=50)
class Baseline(Metrics, Confusion):
    positives: int | None = None
    precision: float | None = None
    recall: float | None = None
    rows: int | None = None
class Layer(Strict):
    input: int
    output: int
    kernel: list[float] = Field(max_length=104)
    bias: list[float] = Field(max_length=8)
class Sample(Strict):
    prediction: float = Field(ge=0,le=1)
    actual: Literal[0,1]
    raw: list[float] = Field(min_length=13,max_length=13)
    normalized: list[float] = Field(min_length=13,max_length=13)
    activations: list[list[float]] = Field(min_length=3,max_length=3)
class Scaler(Strict):
    mean: list[float] = Field(min_length=13,max_length=13)
    scale: list[float] = Field(min_length=13,max_length=13)
class Result(Strict):
    type: Literal['done']
    epoch: int
    completedEpochs: int
    stopReason: Literal['earlyStopping','maxEpochs']
    metrics: NetworkMetrics
    baseline: Baseline
    columns: list[str] = Field(min_length=13,max_length=13)
    samples: list[Sample] = Field(min_length=50,max_length=50)
    weights: list[Layer] = Field(min_length=3,max_length=3)
    confusion: Confusion
    elapsedMs: float = Field(ge=0)
    tensorBytes: int = Field(ge=0)
    config: Config
    datasetHash: Literal[HASH]
class Checkpoint(Strict):
    version: Literal[1]
    classification: Literal['SYNTHETIC DEMO']
    savedAt: str = Field(max_length=40)
    backend: Literal['webgl','cpu']
    result: Result
    history: list[Epoch] = Field(min_length=1,max_length=200)
    scaler: Scaler

@lru_cache(maxsize=1)
def fixture():
    return json.loads((Path(__file__).resolve().parents[1]/'services/neural_demo_data/test_fixture.json').read_text(encoding='utf-8'))

# La comprobación estructural no prueba que el entrenamiento realmente ocurriera.
def validate_checkpoint(raw: bytes) -> Checkpoint:
    from datetime import datetime
    c = Checkpoint.model_validate_json(raw)
    datetime.fromisoformat(c.savedAt)
    r=c.result
    if r.columns != COLUMNS or not 1 <= r.epoch <= r.completedEpochs <= r.config.epochs or len(c.history)!=r.completedEpochs:
        raise ValueError('dimensions')
    if r.config.earlyStopping and r.config.patience>r.config.epochs or any(x<=0 for x in c.scaler.scale):
        raise ValueError('config')
    for layer,(n,m) in zip(r.weights,[(13,8),(8,4),(4,1)]):
        if (layer.input,layer.output,len(layer.kernel),len(layer.bias))!=(n,m,n*m,m): raise ValueError('weights')
    known=fixture()
    if known["sha256"]!=HASH or r.baseline.model_dump()!=known["baseline"]: raise ValueError("baseline")
    for i,s in enumerate(r.samples):
        if s.raw!=known["test"]["x"][i] or s.actual!=known["test"]["y"][i]: raise ValueError("synthetic sample")
        if [len(a) for a in s.activations]!=[8,4,1] or abs(s.activations[-1][0]-s.prediction)>1e-5: raise ValueError('activations')
    for m in [r.confusion,r.baseline]:
        if m.tp+m.tn+m.fp+m.fn!=50: raise ValueError('confusion')
    for i,e in enumerate(c.history,1):
        if e.epoch!=i or not 1<=e.bestEpoch<=i or e.staleEpochs!=i-e.bestEpoch: raise ValueError('history')
    if c.history[-1].bestEpoch!=r.epoch: raise ValueError('best')
    return c

async def audit(conn, actor, action, model_id):
    await conn.execute(text("INSERT INTO app.audit_logs(actor_id,action,resource,resource_id) VALUES (:actor,:action,'neural_demo_model',:id)"),{'actor': actor, 'action': action, 'id': model_id})

@router.get('')
async def list_models(auth_id: UUID=Depends(authenticated_user_id), engine: AsyncEngine=Depends(require_engine)):
    async with engine.connect() as conn:
        await _require_superadmin(conn,auth_id)
        rows=(await conn.execute(text("SELECT id,created_at,archived_at,dataset_hash FROM app.neural_demo_models ORDER BY created_at DESC LIMIT 100"))).mappings().all()
        return {'items':[dict(row) for row in rows]}

@router.post('',status_code=201)
async def register(request: Request, auth_id: UUID=Depends(authenticated_user_id), engine: AsyncEngine=Depends(require_engine)):
    async with engine.connect() as conn: await _require_superadmin(conn,auth_id)
    raw=bytearray()
    async for chunk in request.stream():
        if len(raw)+len(chunk)>131072: raise HTTPException(413,'Checkpoint demasiado grande')
        raw.extend(chunk)
    try: c=validate_checkpoint(bytes(raw))
    except (ValueError,ValidationError,RecursionError): raise HTTPException(422,'Checkpoint DEMO incompatible') from None
    async with engine.begin() as conn:
        actor=await _require_superadmin(conn,auth_id)
        # Límite global conservador, serializado para proteger la cuota gratuita.
        await conn.execute(text('SELECT pg_advisory_xact_lock(3163)'))
        if (await conn.execute(text('SELECT count(*) FROM app.neural_demo_models'))).scalar_one()>=100:
            raise HTTPException(409,'Límite de 100 registros DEMO alcanzado')
        model_id=(await conn.execute(text('INSERT INTO app.neural_demo_models(created_by,dataset_hash,checkpoint) VALUES (:actor,:hash,CAST(:body AS jsonb)) RETURNING id'),{'actor': actor, 'hash': HASH, 'body': c.model_dump_json(exclude_none=False)})).scalar_one()
        await audit(conn,actor,'register',model_id)
        return {'id':model_id}

@router.get('/{model_id}')
async def recover(model_id: UUID,auth_id: UUID=Depends(authenticated_user_id),engine: AsyncEngine=Depends(require_engine)):
    async with engine.begin() as conn:
        actor=await _require_superadmin(conn,auth_id)
        value=(await conn.execute(text('SELECT checkpoint FROM app.neural_demo_models WHERE id=:id AND archived_at IS NULL'),{'id':model_id})).scalar_one_or_none()
        if value is None: raise HTTPException(404,'Modelo no disponible')
        await audit(conn,actor,'recover',model_id)
        return value if isinstance(value,dict) else json.loads(value)

@router.patch('/{model_id}/archive')
async def archive(model_id: UUID,auth_id: UUID=Depends(authenticated_user_id),engine: AsyncEngine=Depends(require_engine)):
    async with engine.begin() as conn:
        actor=await _require_superadmin(conn,auth_id)
        found=(await conn.execute(text('UPDATE app.neural_demo_models SET archived_at=now() WHERE id=:id AND archived_at IS NULL RETURNING id'),{'id':model_id})).scalar_one_or_none()
        if found is None: raise HTTPException(404,'Modelo no disponible')
        await audit(conn,actor,'archive',model_id)
        return {'id':model_id}
