/** Funciones puras: escala ajustada únicamente con train y métricas binarias. */
export interface Partition { x: number[][]; y: number[] }
export function fitScaler(x: number[][]) {
  if (!x.length || !x[0]?.length) throw new Error('Empty dataset');
  const mean = x[0].map((_, j) => x.reduce((s, row) => s + row[j]!, 0) / x.length);
  const scale = mean.map((m, j) => Math.sqrt(x.reduce((s, row) => s + (row[j]! - m) ** 2, 0) / x.length) || 1);
  return { mean, scale };
}
export function transform(x: number[][], scaler: ReturnType<typeof fitScaler>) {
  return x.map(row => row.map((v, j) => (v - scaler.mean[j]!) / scaler.scale[j]!));
}
export function evaluate(y: number[], p: number[]) {
  if (!y.length || y.length !== p.length || p.some(v => !Number.isFinite(v) || v < 0 || v > 1)) throw new Error('Invalid predictions');
  let tp = 0, fp = 0, fn = 0, tn = 0, brier = 0, loss = 0, wins = 0, pairs = 0;
  y.forEach((v, i) => {
    const q = p[i]!;
    if (v === 1) { if (q >= .5) tp++; else fn++; } else { if (q >= .5) fp++; else tn++; }
    brier += (q - v) ** 2;
    loss -= v * Math.log(Math.max(1e-7, q)) + (1-v) * Math.log(Math.max(1e-7, 1-q));
    if (v === 1) y.forEach((other, j) => { if (other === 0) { pairs++; wins += q > p[j]! ? 1 : q === p[j]! ? .5 : 0; } });
  });
  return { accuracy: (tp+tn)/y.length, f1: (2*tp)/(2*tp+fp+fn || 1), roc_auc: pairs ? wins/pairs : null, brier: brier/y.length, log_loss: loss/y.length };
}

/** Matriz de confusión con el mismo umbral fijo que el baseline. */
export function confusion(y:number[], p:number[]) {
  if(y.length!==p.length || y.some(v=>v!==0&&v!==1) || p.some(v=>!Number.isFinite(v)||v<0||v>1)) throw new Error('Invalid predictions');
  const counts={tp:0,tn:0,fp:0,fn:0};
  y.forEach((v,i)=>{if(v===1) {if(p[i]!>=.5) counts.tp++;else counts.fn++;} else {if(p[i]!>=.5) counts.fp++;else counts.tn++;}});
  return counts;
}
