/** Regresión estructural: navegación accesible y un único laboratorio persistente. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../src/modules/intelligence');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
test('cinco pestañas con estado compartido y navegación de teclado',()=>{
  const page=read('NeuralNetworkPage.tsx');
  const tabs=read('ml/labTabs.ts');
  assert.match(tabs,/\['architecture','training','evaluation','inspection','models'\]/);
  assert.match(page,/useState<LabTab>\('architecture'\)/);
  assert.equal((page.match(/<LocalTrainingPanel\b/g)||[]).length,1);
  assert.match(page,/<LocalTrainingPanel[^>]* tab=\{tab\}[\s\S]*?\{tab==='architecture' &&/);
  assert.doesNotMatch(page,/<LocalTrainingPanel[^>]*\bkey=/);
  assert.match(page,/role="tablist"/);
  assert.match(page,/role="tabpanel"/);
  assert.match(page,/ArrowRight/);
  assert.match(page,/ArrowLeft/);
  assert.match(page,/onSample=\{setSampleIndex\}/);
});
test('cada sección tiene su responsabilidad sin duplicar el trabajador',()=>{
  const panel=read('components/LocalTrainingPanel.tsx');
  const details=read('components/ExperimentDetails.tsx');
  assert.equal((panel.match(/new Worker\(/g)||[]).length,1);
  assert.match(panel,/\{tab==='training'&&<>[\s\S]*?<TrainingHistory/);
  assert.match(panel,/\{tab==='models'&&<section[\s\S]*?st\[action\]/);
  assert.match(panel,/tab==='evaluation'&&result/);
  assert.match(panel,/tab==='inspection'&&result/);
  assert.match(details,/historyOpen,setHistoryOpen\]=useState\(false\)/);
  for(const id of ['details','sample','activation','weights'])assert.ok(details.includes(`opened.includes('${id}')`));
});
