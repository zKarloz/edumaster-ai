/** Regresión estructural: integración con la oferta y componentes compartidos. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'../src',p),'utf8');
test('recomendaciones disponibles en ofertas, no en cursos base',()=>{
 const page=read('modules/academic/CourseWorkspacePage.tsx');
 assert.match(page,/offeringId&&<button role="tab" aria-selected=\{tab==='recommendations'\}/);
 assert.match(page,/tab==='recommendations' && offeringId/);
 assert.match(page,/TeacherRecommendations key=\{`\$\{organizationId\}:\$\{offeringId\}`\}/);
});
test('recomendaciones humanas con permisos de servidor y componentes compartidos',()=>{
 const panel=read('modules/academic/TeacherRecommendations.tsx');
 for(const name of ['DataTable','Modal','Spinner','useToast'])assert.match(panel,new RegExp(name));
 assert.match(panel,/Authorization:`Bearer \$\{token\}`/);
 assert.match(panel,/data\?\.editor&&/);
 assert.match(panel,/!data\?\.editor&&!selected\.completed_at/);
 assert.match(panel,/\/course-offerings\/\$\{offeringId\}\/recommendations/);
 assert.match(panel,/notify\(method==='POST'\?t\.saved:t\.completed,'success'\)/);
 assert.doesNotMatch(panel,/demoDataset|new Worker|localStorage/);
});
test('insignias semánticas de recomendaciones y sugerencias en tres temas',()=>{
 const panel=read('modules/academic/TeacherRecommendations.tsx');
 const css=read('styles.css');
 for(const name of ['app-workspace-published','app-workspace-archived','app-recommendation-high'])assert.match(panel,new RegExp(name));
 assert.match(css,/html\.dark:not\(\.black-theme\) \.app-recommendation-high/);
 assert.match(css,/html\.black-theme \.app-recommendation-high/);
 assert.match(panel,/normal:'Media'/);
 assert.match(panel,/normal:'Medium'/);
 assert.match(panel,/normal:'Média'/);
});
test('sugerencias separadas, basadas en reglas y enlazadas a tareas',()=>{
 const panel=read('modules/academic/TeacherRecommendations.tsx');
 assert.match(panel,/url\+'\/suggestions'/);
 assert.match(panel,/studentView=data\?\.editor===false/);
 assert.match(panel,/no son predicciones neuronales/);
 assert.match(panel,/courseTaskPath\(organizationId,offeringId,item.task_id\)/);
 assert.match(panel,/controller\.abort\(\)/);
});

test('cuenta regresiva absoluta y umbral de prioridad: Lima y UTC equivalentes',()=>{
 const ts=require('typescript');const vm=require('node:vm');const exports={};
 vm.runInNewContext(ts.transpileModule(read('modules/academic/recommendationDeadline.ts'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Intl,Date,Number,Math});
 const now=Date.parse('2026-11-26T02:00:00-05:00');
 const remaining=exports.remainingTime;
 assert.equal(remaining('2026-11-26T23:59:00-05:00',now,'es').label,'21 horas · 59 minutos');
 assert.equal(remaining('2026-11-27T04:59:00Z',now,'es').label,'21 horas · 59 minutos');
 assert.equal(remaining('2026-11-28T07:00:00Z',now,'es').high,true);
 assert.equal(remaining('2026-11-28T07:00:01Z',now,'es').high,false);
 assert.equal(remaining('2026-11-26T06:59:00Z',now,'es').expired,true);
 assert.equal(remaining(null,now,'es'),null);
 assert.equal(remaining('2026-11-26T23:59:00',now,'es'),null);
 assert.match(read('modules/academic/TeacherRecommendations.tsx'),/author:'Docente'/);
 assert.match(read('modules/academic/TeacherRecommendations.tsx'),/rules\.remaining\}: \{item\.remaining\}/);
});
