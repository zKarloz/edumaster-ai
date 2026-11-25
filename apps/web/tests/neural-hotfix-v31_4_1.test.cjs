/** Regresión: detención configurable, mensajes incrementales y bordes temáticos. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../src/modules/intelligence');
const {execFileSync}=require('node:child_process');
test('detención anticipada y límite de épocas son distintos',()=>{
 execFileSync(process.execPath,['--experimental-strip-types','-e',`const assert=require('node:assert/strict');const {defaults,validConfig,shouldStopEarly}=require(${JSON.stringify(path.join(root,'ml/protocol.ts'))});
 assert.equal(shouldStopEarly(defaults,13,6),false);
 assert.equal(shouldStopEarly(defaults,14,6),true);
 assert.equal(shouldStopEarly({...defaults,earlyStopping:false},14,6),false);
 assert.equal(shouldStopEarly({...defaults,epochs:14},14,6),false);
 assert.ok(validConfig({...defaults,epochs:2,earlyStopping:false}));
 assert.equal(validConfig({...defaults,earlyStopping:'false'}),false);`]);
});
test('contratos de actualización por época y controles de inspección',()=>{
 const worker=fs.readFileSync(path.join(root,'workers/training.worker.ts'),'utf8');
 const panel=fs.readFileSync(path.join(root,'components/LocalTrainingPanel.tsx'),'utf8');
 const details=fs.readFileSync(path.join(root,'components/ExperimentDetails.tsx'),'utf8');
 assert.match(worker,/send\(\{type:'epoch',epoch:completedEpochs,loss,validationLoss,bestEpoch,staleEpochs\}\)/);
 assert.match(panel,/flushSync\(\(\)=>\{setEpoch\(data\);setHistory/);
 assert.match(details,/onPointerEnter/);assert.match(details,/onFocus/);
 assert.match(details,/border-\[var\(--app-panel-border\)\]/);
 assert.match(details,/border-\[var\(--app-control-border\)\]/);
});
