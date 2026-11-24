/** v30.2.6: contratos UX para fecha/hora, revisión docente y tema Negro. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=relative=>fs.readFileSync(path.join(__dirname,'../src',relative),'utf8');

test('nueva tarea muestra hora 23:59 y no fuerza una fecha de entrega',()=>{
  const page=source('modules/academic/CourseTaskPage.tsx');
  assert.match(page,/\[dueDay,setDueDay\]=useState\(''\)/);
  assert.match(page,/\[dueTime,setDueTime\]=useState\('23:59'\)/);
  assert.match(page,/type="date" value=\{dueDay\}/);
  assert.match(page,/type="time"[^>]*value=\{dueTime\}/);
  assert.match(page,/due_at:taskLocalDateToISO\(dueDay\?`\$\{dueDay\}T\$\{dueTime\}`:''\)/);
});

test('docente ve la tabla de entregas dentro de la tarea y sin botón para navegar a otra lista',()=>{
  const task=source('modules/academic/CourseTaskPage.tsx');
  const list=source('modules/academic/TaskSubmissionsPage.tsx');
  const review=source('modules/academic/TaskSubmissionReviewPage.tsx');
  assert.match(task,/editor&&task&&task.status!=='draft'&&<TaskSubmissionsPage/);
  assert.match(task,/token=\{token\} embedded\/>/);
  assert.doesNotMatch(task,/navigate\(taskSubmissionsPath\(/);
  assert.match(list,/embedded=false/);
  assert.match(list,/<DataTable<Submission>/);
  assert.match(list,/limit=\$\{pageSize\}&offset=\$\{page\*pageSize\}/);
  assert.match(review,/navigate\(`\$\{courseTaskPath\(/);
});

test('Cerrar tarea está arriba a la derecha y la confirmación se mantiene',()=>{
  const task=source('modules/academic/CourseTaskPage.tsx');
  const upper=task.slice(task.indexOf('return <section'),task.indexOf('{loading&&<Spinner'));
  assert.match(upper,/task.status==='published'/);
  assert.match(upper,/onClick=\{\(\)=>setConfirmAction\('close'\)\}/);
  assert.match(task,/changeStatus\(confirmAction\)/);
});

test('tema Negro conserva acento del curso sin volver gris las pestañas',()=>{
  const css=source('styles.css');
  assert.match(css,/html\.black-theme \.app-course-tabs-scroll \{[^}]*--course-accent[^}]*filter: none/s);
  assert.doesNotMatch(css,/app-course-tabs-scroll \{ filter: grayscale\(1\)/);
});
