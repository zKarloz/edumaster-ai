/** Regresión: resumen del curso sin placeholders y encabezados estables al expandir. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'../src',p),'utf8');
test('Inicio conserva resumen y retira tarjetas redundantes sin quitar la pestaña Tareas',()=>{
 const source=read('modules/academic/CourseWorkspacePage.tsx');
 const overview=source.split("{tab==='overview' ? <section")[1].split("</section> : tab==='tasks'")[0];
 assert.match(overview,/workspace\.about/);
 assert.match(overview,/workspace\.publishedLessons/);
 assert.doesNotMatch(overview,/workspace\.(tasks|assessments|nextPhase)/);
 assert.match(source,/tab==='tasks' && offeringId/);
 assert.match(source,/tab==='community' && offeringId/);
 assert.match(source,/tab==='recommendations' && offeringId/);
 assert.doesNotMatch(read('i18n.ts'),/Las tareas y evaluaciones llegarán después|Assignments and assessments will follow|Tarefas e avaliações virão depois/);
});
test('encabezados del sidebar mantienen altura, una línea y recorte durante la transición',()=>{
 const source=read('App.tsx');
 assert.match(source,/app-sidebar-group-heading h-5 overflow-hidden whitespace-nowrap/);
 assert.match(source,/shrink-0 whitespace-nowrap \$\{sidebarWide \? '' : 'md:hidden'\}/);
 assert.match(source,/app-sidebar-category-dash/);
});
