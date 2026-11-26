/** El diagnóstico no altera el dataset ni inicia entrenamiento. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'../src/modules/intelligence',p),'utf8');
test('diagnóstico institucional separado y restringido en la interfaz',()=>{
 const page=read('NeuralNetworkPage.tsx');
 const panel=read('components/AcademicReadiness.tsx');
 assert.match(page,/tab==='training' && canRegister && token && <AcademicReadiness/);
 assert.match(panel,/Authorization:`Bearer \$\{token\}`/);
 assert.match(panel,/training_authorized!==false/);
 assert.match(panel,/data.organization_id!==org/);
 assert.match(panel,/useState\(false\)/);
 assert.doesNotMatch(panel,/new Worker|demoDataset|onResult/);
});
