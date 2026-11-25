import type { evaluate } from './core';
/** Configuración limitada para evitar sobrecargar el dispositivo. */
export interface TrainingConfig { epochs:number; batchSize:number; learningRate:number; patience:number; seed:number; earlyStopping:boolean }
export const defaults: TrainingConfig = {epochs:60,batchSize:16,learningRate:.01,patience:8,seed:42,earlyStopping:true};
export function validConfig(c:TrainingConfig) {
  return typeof c.earlyStopping==='boolean'&&Number.isInteger(c.epochs)&&c.epochs>=1&&c.epochs<=200&&[8,16,32,64].includes(c.batchSize)&&Number.isFinite(c.learningRate)&&c.learningRate>=.0001&&c.learningRate<=.05&&Number.isInteger(c.patience)&&c.patience>=1&&(!c.earlyStopping||c.patience<=c.epochs)&&Number.isInteger(c.seed)&&c.seed>=0&&c.seed<=1000000;
}
/** La última época programada se distingue de una detención anticipada. */
export function shouldStopEarly(c:TrainingConfig, completed:number, best:number) {
  return c.earlyStopping && completed<c.epochs && completed-best>=c.patience;
}
export interface Sample { prediction:number; actual:number; raw:number[]; normalized:number[]; activations:number[][] }
export interface LayerWeights { input:number; output:number; kernel:number[]; bias:number[] }
export interface Confusion {tp:number;tn:number;fp:number;fn:number}
export type WorkerEvent =
  | {type:'backend';backend:string}
  | {type:'epoch';epoch:number;loss:number;validationLoss:number;bestEpoch:number;staleEpochs:number}
  | {type:'done';epoch:number;completedEpochs:number;stopReason:'earlyStopping'|'maxEpochs';metrics:ReturnType<typeof evaluate>;baseline:{f1:number;roc_auc:number|null;brier:number;log_loss:number}&Confusion; columns:string[]; samples:Sample[]; weights:LayerWeights[]; confusion:Confusion; elapsedMs:number; tensorBytes:number; config:TrainingConfig; datasetHash:string}
  | {type:'error';message:string};
