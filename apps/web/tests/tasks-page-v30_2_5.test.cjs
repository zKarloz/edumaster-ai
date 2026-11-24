/** v30.2.5: contratos de navegación, aislamiento y controles sin modales. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');
const source=relative=>fs.readFileSync(path.join(__dirname,'../src',relative),'utf8');
const routes=ts.transpileModule(source('routes.ts'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
}).outputText;
const moduleRef={exports:{}};
vm.runInNewContext(routes,{exports:moduleRef.exports,module:moduleRef,RegExp,Error});
const {courseTaskPath,courseTaskDetail,newCourseTaskPath,sectionForPath,myTaskSubmissionsPath}=moduleRef.exports;
const org='11111111-1111-4111-8111-111111111111';
const offering='33333333-3333-4333-8333-333333333333';
const task='44444444-4444-4444-8444-444444444444';
test('la ficha de una tarea tiene URL válida, enlace directo y contexto institucional',()=>{
  const url=courseTaskPath(org,offering,task);
  assert.equal(courseTaskDetail(url).taskId,task);
  assert.equal(courseTaskDetail(url).organizationId,org);
  assert.equal(sectionForPath(url),'courses');
  assert.equal(courseTaskDetail(url.replace(task,'cualquier-cadena')),null);
  assert.equal(courseTaskDetail(newCourseTaskPath(org,offering)).taskId,'nueva');
  assert.equal(courseTaskDetail(myTaskSubmissionsPath(org,offering,task)),null);
});
test('el catálogo presenta tarjetas seleccionables y no muestra Mis entregas ni envío modal',()=>{
  const panel=source('modules/academic/CourseTasksPanel.tsx');
  assert.match(panel,/tasks\.map\(task=><button/);
  assert.match(panel,/navigate\(courseTaskPath\(/);
  assert.doesNotMatch(panel,/<Modal/);
  assert.doesNotMatch(panel,/navigate\(myTaskSubmissionsPath\(/);
});
test('el detalle presenta envío y archivos en la página y valida el rol y la matrícula',()=>{
  const detail=source('modules/academic/CourseTaskPage.tsx');
  assert.match(detail,/canSendTextSubmission\(/);
  assert.match(detail,/hasSubmissionContent\(/);
  assert.match(detail,/my-submissions/);
  assert.match(detail,/<TaskStagedFiles/);
  assert.match(detail,/<TaskSubmissionFileList/);
  assert.match(detail,/setShowComposer\(true\)/);
  assert.match(detail,/<Modal open=\{confirmAction !== null\}/);
  assert.doesNotMatch(detail,/<Modal[^>]*title=\{t.send\}/); // Los envíos siguen en la página; solo acciones irreversibles usan modal.
});
test('controles Actualizar de listados desaparecen sin interferir con recargas tras mutaciones',()=>{
  const modules=[
    'modules/academic/CourseTasksPanel.tsx',
    'modules/academic/CourseWorkspacePage.tsx',
    'modules/academic/AcademicPage.tsx',
    'modules/academic/AcademicActivityPage.tsx',
    'modules/academic/TaskSubmissionsPage.tsx',
    'modules/academic/MyTaskSubmissionsPage.tsx',
    'modules/users/UsersPage.tsx',
    'modules/organizations/OrganizationsPage.tsx',
  ];
  for(const file of modules){
    assert.doesNotMatch(source(file),/<RefreshCcw|<RefreshCw|onRefresh=/,file);
  }
  assert.match(source('modules/academic/AcademicPage.tsx'),/setRefresh\(/);
});
test('las pestañas heredan el color del curso y muestran un tono más oscuro',()=>{
  const workspace=source('modules/academic/CourseWorkspacePage.tsx');
  const css=source('styles.css');
  assert.match(workspace,/style=\{courseCardStyle\(workspace\.course\.appearance_color\)\}/);
  assert.match(css,/\.app-course-tabs-scroll \{\s*background: color-mix\(in srgb, var\(--course-accent/);
  assert.match(css,/html\.black-theme \.app-course-tabs-scroll/);
});
