/** Entrenamiento experimental local. Cancelar termina el worker y su contexto. */
import * as tf from '@tensorflow/tfjs';
import dataset from '../ml/demoDataset.json';
import { evaluate, fitScaler, transform, confusion } from '../ml/core';
import { validConfig, shouldStopEarly, type TrainingConfig, type WorkerEvent } from '../ml/protocol';
const channel = self as unknown as { postMessage: (event: WorkerEvent) => void; onmessage: ((event: MessageEvent) => void) | null };
const send = (event: WorkerEvent) => channel.postMessage(event);
let running = false;
async function train(config:TrainingConfig) {
  if(!config || !validConfig(config)) throw new Error('Invalid configuration');
  const started=performance.now();
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
  const optimizer = tf.train.adam(config.learningRate);
  let best: tf.Tensor[] = [], bestLoss = Infinity, bestEpoch = 0, completedEpochs = 0;
  let stopReason: 'earlyStopping' | 'maxEpochs' = 'maxEpochs';
  try {
    model.add(tf.layers.dense({inputShape:[width],units:8,activation:'relu',kernelInitializer:tf.initializers.glorotUniform({seed:config.seed})}));
    model.add(tf.layers.dense({units:4,activation:'relu',kernelInitializer:tf.initializers.glorotUniform({seed:config.seed+1})}));
    model.add(tf.layers.dense({units:1,activation:'sigmoid',kernelInitializer:tf.initializers.glorotUniform({seed:config.seed+2})}));
    model.compile({optimizer,loss:'binaryCrossentropy'});
    await model.fit(a!.x,a!.y,{epochs:config.epochs,batchSize:config.batchSize,shuffle:false,validationData:[b!.x,b!.y],callbacks:{onEpochEnd:async(epoch,logs)=>{
      const loss = Number(logs?.loss), validationLoss = Number(logs?.val_loss);
      if (!Number.isFinite(loss) || !Number.isFinite(validationLoss)) throw new Error('Non-finite loss');
      if (validationLoss < bestLoss - 1e-6) { best.forEach(t=>t.dispose()); best = tf.tidy(()=>model.getWeights().map(t=>t.clone())); bestLoss=validationLoss; bestEpoch=epoch+1; }
      completedEpochs=epoch+1;
      const staleEpochs=completedEpochs-bestEpoch;
      send({type:'epoch',epoch:completedEpochs,loss,validationLoss,bestEpoch,staleEpochs});
      if (shouldStopEarly(config,completedEpochs,bestEpoch)) {
        stopReason='earlyStopping'; model.stopTraining=true;
      }
      // Ceder tiempo al navegador para pintar cada época; incluye una breve pausa visual.
      await new Promise<void>(resolve=>setTimeout(resolve,60));
    }}});
    model.setWeights(best);
    // Test no interviene en la selección de época. Activaciones de una fila DEMO.
    const p = tf.tidy(()=>Array.from((model.predict(c!.x) as tf.Tensor).dataSync()));
    // Capturar activaciones y parámetros del checkpoint restaurado, no de la última época.
    const normalized=transform(test.x,scaler);
    const samples=test.x.map((raw,i)=>({raw,normalized:normalized[i]!,actual:test.y[i]!,prediction:p[i]!,activations:tf.tidy(()=>{
      let current:tf.Tensor=c!.x.slice([i,0],[1,width]);
      return model.layers.map(layer=>{current=layer.apply(current,{training:false}) as tf.Tensor;return Array.from(current.dataSync());});
    })}));
    const weights=model.layers.map(layer=>tf.tidy(()=>{
      const [kernel,bias]=layer.getWeights();
      return {input:kernel!.shape[0]!,output:kernel!.shape[1]!,kernel:Array.from(kernel!.dataSync()),bias:Array.from(bias!.dataSync())};
    }));
    send({type:'done',epoch:bestEpoch,completedEpochs,stopReason,metrics:evaluate(test.y,p),baseline:dataset.baseline,columns:dataset.columns,samples,weights,confusion:confusion(test.y,p),elapsedMs:performance.now()-started,tensorBytes:tf.memory().numBytes,config,datasetHash:dataset.sha256});
  } finally { best.forEach(t=>t.dispose()); tensors.forEach(t=>{t.x.dispose();t.y.dispose();}); model.dispose(); optimizer.dispose(); }
}
channel.onmessage = (event) => { if (running || event.data?.type!=='start') return; running=true; void train(event.data.config).catch(error=>send({type:'error',message:error instanceof Error ? error.message : 'Training failed'})); };
