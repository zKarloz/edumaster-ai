/** Contrato local DEMO: no contiene identidad ni datos institucionales. */
import type { WorkerEvent } from './protocol';
type Result=Extract<WorkerEvent,{type:'done'}>;
type Epoch=Extract<WorkerEvent,{type:'epoch'}>;
export interface LocalCheckpoint {
 version:1; classification:'SYNTHETIC DEMO'; savedAt:string; backend:string;
 result:Result; history:Epoch[]; scaler:{mean:number[];scale:number[]};
}
const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
const vector=(v:unknown,n:number):v is number[]=>Array.isArray(v)&&v.length===n&&v.every(finite);
/** Rechaza registros incompatibles o dañados antes de mostrarlos. No certifica su autenticidad. */
export function validCheckpoint(value:unknown,hash:string,columns:string[],sampleCount:number):value is LocalCheckpoint {
 try {
  const c=value as LocalCheckpoint; const r=c.result; const n=columns.length;
  if(c.version!==1||c.classification!=='SYNTHETIC DEMO'||!Number.isFinite(Date.parse(c.savedAt))||!['webgl','cpu'].includes(c.backend))return false;
  if(r.type!=='done'||r.datasetHash!==hash||!Array.isArray(r.columns)||r.columns.length!==n||!columns.every((v,i)=>v===r.columns[i]))return false;
  const cfg=r.config;
  if(!Number.isInteger(cfg.epochs)||cfg.epochs<1||cfg.epochs>200||![8,16,32,64].includes(cfg.batchSize)||!finite(cfg.learningRate)||cfg.learningRate<.0001||cfg.learningRate>.05||!Number.isInteger(cfg.patience)||cfg.patience<1||typeof cfg.earlyStopping!=='boolean'||(cfg.earlyStopping&&cfg.patience>cfg.epochs)||!Number.isInteger(cfg.seed)||cfg.seed<0||cfg.seed>1000000)return false;
  if(!Number.isInteger(r.epoch)||!Number.isInteger(r.completedEpochs)||r.epoch<1||r.epoch>r.completedEpochs||r.completedEpochs>cfg.epochs||!['earlyStopping','maxEpochs'].includes(r.stopReason)||!finite(r.elapsedMs)||r.elapsedMs<0||!finite(r.tensorBytes)||r.tensorBytes<0)return false;
  if(!vector(c.scaler.mean,n)||!vector(c.scaler.scale,n)||c.scaler.scale.some(v=>v<=0))return false;
  const dims=[n,8,4,1];
  if(!Array.isArray(r.weights)||r.weights.length!==3||!r.weights.every((w,i)=>w.input===dims[i]&&w.output===dims[i+1]&&vector(w.kernel,w.input*w.output)&&vector(w.bias,w.output)))return false;
  if(!Array.isArray(r.samples)||r.samples.length!==sampleCount||!r.samples.every(s=>vector(s.raw,n)&&vector(s.normalized,n)&&[0,1].includes(s.actual)&&finite(s.prediction)&&s.prediction>=0&&s.prediction<=1&&Array.isArray(s.activations)&&s.activations.length===3&&s.activations.every((a,i)=>vector(a,dims[i+1]!))&&Math.abs(s.activations[2]![0]!-s.prediction)<1e-5))return false;
  for(const m of [r.metrics,r.baseline]){if(![m.f1,m.brier].every(v=>finite(v)&&v>=0&&v<=1)||!finite(m.log_loss)||m.log_loss<0||!(m.roc_auc===null||(finite(m.roc_auc)&&m.roc_auc>=0&&m.roc_auc<=1)))return false;}
  for(const m of [r.confusion,r.baseline]){const a=[m.tp,m.tn,m.fp,m.fn];if(!a.every(v=>Number.isInteger(v)&&v>=0)||a.reduce((s,v)=>s+v,0)!==sampleCount)return false;}
  return Array.isArray(c.history)&&c.history.length===r.completedEpochs&&c.history.every((e,i)=>e.type==='epoch'&&e.epoch===i+1&&finite(e.loss)&&finite(e.validationLoss)&&Number.isInteger(e.bestEpoch)&&e.bestEpoch>=1&&e.bestEpoch<=e.epoch&&e.staleEpochs===e.epoch-e.bestEpoch)&&c.history[c.history.length-1]?.bestEpoch===r.epoch;
 }catch{return false;}
}
