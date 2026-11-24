/* Regresión de rutas profundas de lecciones, sin navegador ni autenticación. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');
const input=fs.readFileSync(path.join(__dirname,'../src/routes.ts'),'utf8');
const js=ts.transpileModule(input,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const exportsObject={};
vm.runInNewContext(js,{exports:exportsObject,Object,RegExp,Error},{filename:'routes.cjs'});
const routes=exportsObject;
const org='11111111-1111-1111-1111-111111111111';
const course='22222222-2222-2222-2222-222222222222';
const offering='33333333-3333-3333-3333-333333333333';
const lesson='44444444-4444-4444-4444-444444444444';

test('ruta institucional profunda conserva curso, lección y origen',()=>{
  const path=routes.lessonEditorPath(org,lesson,'base',undefined,course);
  const parsed=routes.lessonEditorDetail(path);
  assert.equal(parsed.lessonId,lesson);
  assert.equal(parsed.courseId,course);
  assert.equal(parsed.source,'base');
  assert.equal(routes.sectionForPath(path),'courses');
});
test('en una oferta, se diferencia contenido base del docente',()=>{
  for (const source of ['base','offering']){
    const path=routes.lessonEditorPath(org,lesson,source,offering);
    const parsed=routes.lessonEditorDetail(path);
    assert.equal(parsed.offeringId,offering);
    assert.equal(parsed.source,source);
    assert.equal(routes.sectionForPath(path),'courses');
  }
});
test('no acepta editor fuera de URLs con UUID válidos',()=>{
  assert.equal(routes.lessonEditorDetail('/academico/organizaciones/test/ofertas/123/lecciones/base/456/editar'),null);
  assert.throws(()=>routes.lessonEditorPath(org,lesson,'offering',undefined,course));
});
