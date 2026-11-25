import type { evaluate } from './core';
/** Contrato entre React y el trabajador; no contiene datos institucionales. */
export type WorkerEvent =
  | { type: 'backend'; backend: string }
  | { type: 'epoch'; epoch: number; loss: number; validationLoss: number }
  | { type: 'done'; epoch: number; metrics: ReturnType<typeof evaluate>; baseline: {f1:number; roc_auc:number|null; brier:number; log_loss:number}; prediction: number; columns: string[]; sample: number[]; activations: number[][] }
  | { type: 'error'; message: string };
