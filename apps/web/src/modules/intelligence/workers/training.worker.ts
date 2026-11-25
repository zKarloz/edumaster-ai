/** Entrenamiento experimental local. Cancelar termina el worker y su contexto. */
import * as tf from '@tensorflow/tfjs';
import dataset from '../ml/demoDataset.json';
import { evaluate, fitScaler, transform } from '../ml/core';
import type { WorkerEvent } from '../ml/protocol';
const channel = self as unknown as { postMessage: (event: WorkerEvent) => void; onmessage: ((event: MessageEvent) => void) | null };
const send = (event: WorkerEvent) => channel.postMessage(event);
let running = false;
async function train() {
  // WebGL en workers depende de OffscreenCanvas y del navegador; CPU es respaldo.
  try { if (!await tf.setBackend('webgl')) throw new Error('WebGL'); await tf.ready(); tf.tidy(() => tf.tensor1d([1]).square().dataSync()); }
  catch { if (!await tf.setBackend('cpu')) throw new Error('CPU unavailable'); await tf.ready(); }
  send({type:'backend', backend:tf.getBackend()});
  const {train, validation, test} = dataset.splits;
  const scaler = fitScaler(train.x);
  const width = dataset.columns.length;
  const tensors = [train, validation, test].map(part => ({x:tf.tensor2d(transform(part.x, scaler), [part.x.length,width]), y:tf.tensor2d(part.y,[part.y.length,1])}));
  const [a,b,c] = tensors;
  const model = tf.sequential();
  const optimizer = tf.train.adam(.01);
  let best: tf.Tensor[] = [], bestLoss = Infinity, bestEpoch = 0;
  try {
    model.add(tf.layers.dense({inputShape:[width],units:8,activation:'relu',kernelInitializer:tf.initializers.glorotUniform({seed:42})}));
    model.add(tf.layers.dense({units:4,activation:'relu',kernelInitializer:tf.initializers.glorotUniform({seed:43})}));
    model.add(tf.layers.dense({units:1,activation:'sigmoid',kernelInitializer:tf.initializers.glorotUniform({seed:44})}));
    model.compile({optimizer,loss:'binaryCrossentropy'});
    await model.fit(a!.x,a!.y,{epochs:60,batchSize:16,shuffle:false,validationData:[b!.x,b!.y],callbacks:{onEpochEnd:async(epoch,logs)=>{
      const loss = Number(logs?.loss), validationLoss = Number(logs?.val_loss);
      if (!Number.isFinite(loss) || !Number.isFinite(validationLoss)) throw new Error('Non-finite loss');
      if (validationLoss < bestLoss - 1e-6) { best.forEach(t=>t.dispose()); best = tf.tidy(()=>model.getWeights().map(t=>t.clone())); bestLoss=validationLoss; bestEpoch=epoch+1; }
      send({type:'epoch',epoch:epoch+1,loss,validationLoss});
      if (epoch+1-bestEpoch >= 8) model.stopTraining=true;
    }}});
    model.setWeights(best);
    // Test no interviene en la selección de época. Activaciones de una fila DEMO.
    const p = tf.tidy(()=>Array.from((model.predict(c!.x) as tf.Tensor).dataSync()));
    const activations = tf.tidy(()=>{
      let current: tf.Tensor = c!.x.slice([0,0],[1,width]);
      return model.layers.map(layer=>{ current=layer.apply(current,{training:false}) as tf.Tensor; return Array.from(current.dataSync()); });
    });
    send({type:'done',epoch:bestEpoch,metrics:evaluate(test.y,p),baseline:dataset.baseline,prediction:p[0]!,columns:dataset.columns,sample:transform([test.x[0]!],scaler)[0]!,activations});
  } finally { best.forEach(t=>t.dispose()); tensors.forEach(t=>{t.x.dispose();t.y.dispose();}); model.dispose(); optimizer.dispose(); }
}
channel.onmessage = () => { if (running) return; running=true; void train().catch(error=>send({type:'error',message:error instanceof Error ? error.message : 'Training failed'})); };
