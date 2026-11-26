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
