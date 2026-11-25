/** Contratos de configuración y matriz binaria ejecutados sin dependencias ML. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const path=require('node:path');
const root=path.resolve(__dirname,'../src/modules/intelligence/ml');
function run(file,body){execFileSync(process.execPath,['--experimental-strip-types','-e',`const assert=require('node:assert/strict');const api=require(${JSON.stringify(path.join(root,file))});${body}`]);}
test('configuración válida y límites de recursos',()=>run('protocol.ts',`assert.ok(api.validConfig(api.defaults));for(const c of [{epochs:201},{epochs:0},{batchSize:3},{learningRate:NaN},{learningRate:.1},{patience:61},{seed:-1}])assert.equal(api.validConfig({...api.defaults,...c}),false);`));
test('matriz de confusión y umbral de 0.5',()=>run('core.ts',`assert.deepEqual(api.confusion([0,0,1,1],[.1,.5,.49,.9]),{tn:1,fp:1,fn:1,tp:1});assert.throws(()=>api.confusion([0],[NaN]));assert.throws(()=>api.confusion([2],[.5]));`));
