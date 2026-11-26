/** Verifica índices Dense y que la inspección no altera el snapshot. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'../src/modules/intelligence');
test('grafo dinámico conserva pesos, activaciones y contribuciones',()=>{
 execFileSync(process.execPath,['--experimental-strip-types','-e',`const assert=require('node:assert/strict');const {buildGraph}=require(${JSON.stringify(path.join(root,'ml/graph.ts'))});const sample={raw:[2,3],normalized:[-1,2],activations:[[4,5],[.7]],prediction:.7,actual:1};const weights=[{input:2,output:2,kernel:[1,2,3,4],bias:[0,1]},{input:2,output:1,kernel:[.5,-.5],bias:[1]}];const before=JSON.stringify(sample);const g=buildGraph(['a','b'],weights,sample);assert.equal(g.edges.length,6);assert.deepEqual(g.edges[2],{layer:0,from:1,to:0,weight:3,contribution:6});assert.equal(g.values[2][0],.7);assert.equal(JSON.stringify(sample),before);assert.throws(()=>buildGraph(['a'],weights,sample));`]);
});
test('selector conserva laboratorio y comparte ejemplo; no hace inferencias ficticias',()=>{
 const page=fs.readFileSync(path.join(root,'NeuralNetworkPage.tsx'),'utf8');const panel=fs.readFileSync(path.join(root,'components/LocalTrainingPanel.tsx'),'utf8');const graph=fs.readFileSync(path.join(root,'components/TrainedNetwork.tsx'),'utf8');
 assert.doesNotMatch(page,/mode==='concept'|<NeuralNetworkVisualizer/);assert.match(page,/result \? <TrainedNetwork/);assert.match(page,/onSample=\{setSampleIndex\}/);assert.match(panel,/onResult\(null\)/);assert.match(panel,/onResult\(data\)/);assert.match(graph,/buildGraph\(result.columns,result.weights,sample\)/);assert.match(graph,/border-\[var\(--app-panel-border\)\]/);assert.match(graph,/allowMotion/);
});
