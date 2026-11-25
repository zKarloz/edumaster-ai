/** Pruebas numéricas reales, sin instalar TensorFlow.js. Node 22.16+. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'../src/modules/intelligence/ml');
const dataset=JSON.parse(fs.readFileSync(path.join(root,'demoDataset.json')));
// Node 22 permite eliminar anotaciones de tipos sin dependencias.
const {execFileSync}=require('node:child_process');
function numericTest(fn) {
  execFileSync(process.execPath,['--experimental-strip-types','-e',`const assert=require('node:assert/strict'); const {fitScaler,transform,evaluate}=require(${JSON.stringify(path.join(root,'core.ts'))}); (${fn.toString()})();`],{stdio:'pipe'});
}
test('dataset sintético sin identificadores y particiones independientes',()=>{
  assert.equal(dataset.classification,'SYNTHETIC_DEMO');
  assert.equal(dataset.columns.length,13);
  assert.deepEqual(Object.values(dataset.splits).map(p=>p.y.length).sort((a,b)=>a-b),[50,50,150]);
  for(const p of Object.values(dataset.splits)){assert.equal(p.x.length,p.y.length);assert.ok(p.x.every(r=>r.length===13&&r.every(Number.isFinite)));assert.ok(p.y.every(y=>y===0||y===1));}
});
test('escalado train y columna constante',()=>numericTest(()=>{const s=fitScaler([[1,7],[3,7]]);assert.deepEqual(s,{mean:[2,7],scale:[1,1]});assert.deepEqual(transform([[5,7]],s),[[3,0]]);}));
test('métricas perfectas y AUC con empates',()=>numericTest(()=>{const m=evaluate([0,1],[0,1]);assert.equal(m.f1,1);assert.equal(m.roc_auc,1);assert.equal(m.brier,0);assert.equal(evaluate([0,1],[.5,.5]).roc_auc,.5);assert.equal(evaluate([1],[.5]).roc_auc,null);}));
