/** CAMBIOS22 v30.3.1 · Contratos de confirmación y acceso visible a rúbricas.
 * Estas pruebas estructurales se complementan con prueba manual del modal.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const web = file => fs.readFileSync(path.join(__dirname, '../src', file), 'utf8');
const backend = fs.readFileSync(path.join(__dirname, '../../api/app/routers/course_tasks.py'), 'utf8');

test('el formulario de estudiante abre confirmación antes del POST', () => {
  const source = web('modules/academic/CourseTaskPage.tsx');
  const requesting = source.slice(source.indexOf('function requestSubmission('), source.indexOf('async function submitConfirmed('));
  assert.match(requesting, /setConfirmSubmission\(true\)/);
  assert.doesNotMatch(requesting, /method:'POST'/);
  assert.match(source, /onSubmit=\{requestSubmission\}/);
  assert.match(source, /<Modal open=\{confirmSubmission\}/);
  assert.match(source, /onClick=\{\(\) => void submitConfirmed\(\)\}/);
  assert.match(source, /setConfirmSubmission\(false\)/);
  assert.match(source, /disabled=\{busy \|\| attachmentsBusy \|\| !canAnswer/);
});

test('docentes pueden ir directamente a calificar desde la tabla y la revisión', () => {
  const table = web('modules/academic/TaskSubmissionsPage.tsx');
  const review = web('modules/academic/TaskSubmissionReviewPage.tsx');
  const rubric = web('modules/academic/TaskRubricPanel.tsx');
  assert.match(table, /gradeAction:'Calificar con rúbrica'/);
  assert.match(table, /assignment\?\.status==='closed' && item\.status==='reviewed' && item\.is_latest_attempt/);
  assert.match(table, /#calificacion-oficial/);
  assert.match(review, /gradeAction:'Calificar con rúbrica'/);
  assert.match(review, /disabled=\{Boolean\(gradeReason\)\}/);
  assert.match(review, /jumpToGrade/);
  assert.match(review, /location\.hash==='#calificacion-oficial'/);
  assert.match(rubric, /id="calificacion-oficial"/);
});

test('la API restringe el acceso al último intento y el frontend reutiliza Modal', () => {
  assert.match(backend, /AS is_latest_attempt,/);
  assert.match(backend, /newer\.attempt_number>s\.attempt_number/);
  assert.match(web('modules/academic/CourseTaskPage.tsx'), /import \{ Modal \} from ['"]\.\.\/\.\.\/components\/shared\/Modal['"]/);
});

test('las páginas modificadas mantienen sintaxis TSX válida', () => {
  for (const file of [
    'modules/academic/CourseTaskPage.tsx',
    'modules/academic/TaskSubmissionsPage.tsx',
    'modules/academic/TaskSubmissionReviewPage.tsx',
    'modules/academic/TaskRubricPanel.tsx',
  ]) {
    const parsed = ts.transpileModule(web(file), {
      fileName: file, reportDiagnostics: true,
      compilerOptions: {jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022},
    });
    assert.deepEqual(parsed.diagnostics?.map(item => item.messageText), [], file);
  }
});
