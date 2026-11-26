/** Regresiones de integración y reutilización visual. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'../src',p),'utf8');
test('comunidad exclusiva de ofertas',()=>{
 const page=read('modules/academic/CourseWorkspacePage.tsx');
 assert.match(page,/offeringId&&<button role="tab" aria-selected=\{tab==='community'\}/);
 assert.match(page,/tab==='community' && offeringId/);
});
test('comunidad reutiliza componentes y controles temáticos',()=>{
 const panel=read('modules/academic/CourseCommunity.tsx');
 for(const name of ['Modal','Spinner','useToast','--app-panel-border','Authorization','AbortController'])assert.ok(panel.includes(name));
 assert.doesNotMatch(panel,/dangerouslySetInnerHTML/);
 assert.match(panel,/data\.editor&&/);
 assert.match(panel,/data\.writable/);
});
