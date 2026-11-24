// CAMBIOS 21 v30.2.2: rutas profundas de revisión y regreso a la oferta.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const ts=require('typescript');
const source=fs.readFileSync(path.join(__dirname,'../src/routes.ts'),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const moduleRef={exports:{}};
vm.runInNewContext(compiled,{exports:moduleRef.exports,module:moduleRef,Error,RegExp});
const {taskReviewDetail,taskReviewPath,taskSubmissionsDetail,taskSubmissionsPath,courseOfferingPath,sectionForPath}=moduleRef.exports;
const org='11111111-1111-4111-8111-111111111111';
const offering='33333333-3333-4333-8333-333333333333';
const task='44444444-4444-4444-8444-444444444444';
const submission='66666666-6666-4666-8666-666666666666';
test('la revisión conserva institución, oferta, tarea y entrega',()=>{
  const url=taskReviewPath(org,offering,task,submission);
  const parsed=taskReviewDetail(url);
  assert.equal(parsed.organizationId,org);
  assert.equal(parsed.offeringId,offering);
  assert.equal(parsed.taskId,task);
  assert.equal(parsed.submissionId,submission);
  assert.equal(sectionForPath(url),'courses');
});
test('la revisión no acepta rutas con identificadores no UUID',()=>{
  assert.equal(taskReviewDetail(taskReviewPath(org,offering,task,'not-a-uuid')),null);
  assert.equal(taskReviewDetail(courseOfferingPath(org,offering)),null);
});

// v30.2.3: ruta intermedia estable, sin depender del modal anterior.
test('la lista de entregas tiene URL propia y mantiene institución, oferta y tarea',()=>{
  const url=taskSubmissionsPath(org,offering,task);
  assert.equal(url,`${courseOfferingPath(org,offering)}/tareas/${task}/entregas`);
  assert.equal(taskSubmissionsDetail(url).taskId,task);
  assert.equal(taskSubmissionsDetail(url).offeringId,offering);
  assert.equal(sectionForPath(url),'courses');
});
test('la ruta de detalle se encuentra bajo la lista y no acepta identificadores inválidos',()=>{
  const list=taskSubmissionsPath(org,offering,task);
  assert.equal(taskReviewPath(org,offering,task,submission),`${list}/${submission}/revisar`);
  assert.equal(taskSubmissionsDetail(`${list}/not-a-uuid`),null);
  assert.equal(taskSubmissionsDetail(courseOfferingPath(org,offering)),null);
});
