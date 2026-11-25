/** Contratos visuales y de navegación que evitan las regresiones reportadas.
 * Son comprobaciones de estructura; el comportamiento móvil se valida en un dispositivo.
 */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=(relative)=>fs.readFileSync(path.join(__dirname,'../src',relative),'utf8');

test('la verificación usa el perfil, no el esqueleto anónimo',()=>{
  const app=source('App.tsx');
  assert.match(app,/accountStatus === 'checking' \? t\('login.validating'\)/);
  assert.match(app,/UserAvatar userId=\{session.user.id\}/);
  assert.doesNotMatch(app,/return <SessionShell/);
});
test('el docente consulta entregas integradas y regresa desde la revisión individual',()=>{
  const panel=source('modules/academic/CourseTasksPanel.tsx');
  const detail=source('modules/academic/TaskSubmissionReviewPage.tsx');
  assert.match(panel,/navigate\(courseTaskPath\(/);
  assert.match(source('modules/academic/CourseTaskPage.tsx'),/<TaskSubmissionsPage/);
  assert.doesNotMatch(panel,/Modal open=\{selectedTask!==null\}/);
  assert.match(detail,/courseTaskPath\(/);
  assert.match(detail,/className="flex flex-wrap items-center justify-between gap-3"/);
});
test('pestañas del curso mantienen tamaño y admiten scroll horizontal',()=>{
  const workspace=source('modules/academic/CourseWorkspacePage.tsx');
  assert.match(workspace,/app-course-tabs-scroll/);
  assert.match(workspace,/overflow-x-auto/);
  assert.match(workspace,/app-course-tab shrink-0 whitespace-nowrap/);
});
test('la lección publicada tiene contorno con paleta de los tres temas',()=>{
  const view=source('modules/academic/PublishedLessonView.tsx');
  const css=source('styles.css');
  assert.match(view,/app-published-lesson-outline/);
  assert.match(css,/html\.black-theme \.app-published-lesson-outline/);
  assert.match(css,/html\.dark:not\(\.black-theme\) \.app-published-lesson-outline/);
});
