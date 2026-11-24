/** Contratos del flujo nuevo de lecciones: rutas, seguridad y pestañas editoriales. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');
const read=name=>fs.readFileSync(path.join(__dirname,'../src',name),'utf8');
const moduleRef={exports:{}};
vm.runInNewContext(ts.transpileModule(read('routes.ts'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
}).outputText,{exports:moduleRef.exports,module:moduleRef});
const {newLessonPath,newLessonDetail,sectionForPath}=moduleRef.exports;
const org='11111111-1111-4111-8111-111111111111';
const course='22222222-2222-4222-8222-222222222222';
const offering='33333333-3333-4333-8333-333333333333';
const unit='55555555-5555-4555-8555-555555555555';
test('crear lección institucional conserva el curso y la unidad en una ruta profunda',()=>{
  const url=newLessonPath(org,unit,'base',undefined,course);
  assert.equal(newLessonDetail(url).unitId,unit);
  assert.equal(newLessonDetail(url).courseId,course);
  assert.equal(sectionForPath(url),'courses');
  assert.equal(newLessonDetail(url.replace(unit,'cualquier-cosa')),null);
});
test('crear lección de oferta conserva origen y oferta',()=>{
  const url=newLessonPath(org,unit,'offering',offering);
  assert.equal(newLessonDetail(url).source,'offering');
  assert.equal(newLessonDetail(url).offeringId,offering);
  assert.equal(sectionForPath(url),'courses');
});
test('el botón Nueva lección dirige a página y no al modal antiguo',()=>{
  const workspace=read('modules/academic/CourseWorkspacePage.tsx');
  assert.match(workspace,/navigate\(newLessonPath\(organizationId,unit\.id,unit\.source/);
  assert.doesNotMatch(workspace,/onClick=\{\(\)=>showEditor\(\{kind:'lesson',source:unit\.source,unitId:unit\.id\}\)\}/);
});
test('la nueva página crea una sola lección y luego guarda su documento versionado',()=>{
  const page=read('modules/academic/LessonCreatePage.tsx');
  assert.match(page,/if\(!createdId\.current\)/);
  assert.match(page,/method:'POST'/);
  assert.match(page,/method:'PATCH'/);
  assert.match(page,/canonicalLessonDocument\(document\)/);
  assert.match(page,/expected_lock_version:draft\.lock_version/);
  assert.match(page,/useBlocker/);
  assert.match(page,/<RichTextEditor/);
});
test('editor separa recursos del historial en pestañas con aria-selected',()=>{
  const page=read('modules/academic/LessonEditorPage.tsx');
  assert.match(page,/role="tablist"/);
  assert.match(page,/aria-selected=\{editorTab==='content'\}/);
  assert.match(page,/aria-selected=\{editorTab==='history'\}/);
  assert.match(page,/editorTab==='content' && <div/);
  assert.match(page,/editorTab==='history' && <div/);
});
test('publicar y cerrar tarea abren confirmación compartida sin modal de entrega',()=>{
  const page=read('modules/academic/CourseTaskPage.tsx');
  assert.match(page,/setConfirmAction\('publish'\)/);
  assert.match(page,/setConfirmAction\('close'\)/);
  assert.match(page,/<Modal open=\{confirmAction !== null\}/);
  assert.match(page,/AlertTriangle/);
  assert.doesNotMatch(page,/<Modal[^>]*title=\{t.send\}/);
});
test('sidebar mantiene la geometría sin reglas condicionales del modal',()=>{
  const css=read('styles.css');
  assert.doesNotMatch(css,/html:has\(\.app-modal-overlay\) \.app-sidebar/);
  assert.match(css,/\.app-sidebar\s*\{\s*align-self:\s*flex-start/);
  assert.match(css,/overscroll-behavior:\s*contain/);
});
