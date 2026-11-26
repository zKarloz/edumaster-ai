/** Validación numérica y estructural del checkpoint y el recorrido enfocado. */
const {test}=require('node:test');const assert=require('node:assert/strict');
const path=require('node:path');const {execFileSync}=require('node:child_process');const fs=require('node:fs');
const root=path.resolve(__dirname,'../src/modules/intelligence');
function run(file,body){execFileSync(process.execPath,['--experimental-strip-types','-e',`const assert=require('node:assert/strict');const api=require(${JSON.stringify(path.join(root,'ml',file))});${body}`]);}
test('checkpoint DEMO admite un snapshot válido y rechaza datos incompatibles o dañados',()=>run('checkpoint.ts',`
 const columns=['a','b']; const dims=[2,8,4,1];
 const metrics={f1:.5,brier:.2,roc_auc:.5,log_loss:.7,accuracy:.5};
 const confusion={tp:1,tn:0,fp:0,fn:0};
 const r={type:'done',datasetHash:'hash',columns,weights:dims.slice(0,-1).map((n,i)=>({input:n,output:dims[i+1],kernel:Array(n*dims[i+1]).fill(0),bias:Array(dims[i+1]).fill(0)})),samples:[{raw:[1,2],normalized:[0,0],actual:1,prediction:.5,activations:[Array(8).fill(0),Array(4).fill(0),[.5]]}],epoch:1,completedEpochs:1,stopReason:'maxEpochs',metrics,baseline:{...metrics,...confusion},confusion,elapsedMs:100,tensorBytes:123,config:{epochs:1,batchSize:8,learningRate:.01,patience:1,earlyStopping:true,seed:42}};
 const c={version:1,classification:'SYNTHETIC DEMO',savedAt:new Date().toISOString(),backend:'cpu',result:r,history:[{type:'epoch',epoch:1,loss:.7,validationLoss:.8,bestEpoch:1,staleEpochs:0}],scaler:{mean:[1,2],scale:[1,1]}};
 const valid=v=>api.validCheckpoint(v,'hash',columns,1);
 assert.ok(valid(c));assert.equal(api.validCheckpoint(c,'other',columns,1),false);
 for(const edit of [v=>v.version=2,v=>v.classification='REAL',v=>v.result.weights[0].kernel.pop(),v=>v.result.samples[0].prediction=NaN,v=>v.result.samples[0].activations[2][0]=.9,v=>v.scaler.scale[0]=0,v=>v.history=[],v=>v.result.metrics.f1=Infinity,v=>v.result.baseline.tp=3]){const copy=structuredClone(c);edit(copy);assert.equal(valid(copy),false);}
 assert.equal(valid(null),false);
`));
test('enfoque preserva recorridos en las tres etapas y limita conexiones adyacentes',()=>run('pulseFocus.ts',`
 const f=api.pulseFocused;const edges=Array.from({length:3},(_,layer)=>[{layer,from:0,to:0},{layer,from:0,to:1},{layer,from:1,to:0},{layer,from:1,to:1}]).flat();
 for(const node of [{layer:0,index:1},{layer:1,index:1},{layer:2,index:1},{layer:3,index:1}])assert.deepEqual([...new Set(edges.filter(e=>f(e,node,undefined)).map(e=>e.layer))],[0,1,2]);
 for(const selected of edges)assert.deepEqual([...new Set(edges.filter(e=>f(e,null,selected)).map(e=>e.layer))],[0,1,2]);
 assert.equal(f({layer:0,from:0,to:0},{layer:0,index:1},undefined),false);
 assert.equal(f({layer:1,from:0,to:0},null,{layer:1,from:1,to:0}),false);
`));
test('guardado local confirma transacción y recupera el resultado compartido sin entrenar',()=>{
 const panel=fs.readFileSync(path.join(root,'components/LocalTrainingPanel.tsx'),'utf8');const store=fs.readFileSync(path.join(root,'ml/checkpointStorage.ts'),'utf8');
 assert.match(store,/indexedDB\.open/);assert.match(store,/tx\.oncomplete/);assert.match(store,/finally\{db\.close\(\)/);
 assert.match(panel,/validCheckpoint\(value,dataset.sha256/);assert.match(panel,/onResult\(value.result\)/);assert.match(panel,/setHistory\(value.history\)/);assert.match(panel,/storageLock.current/);
});
