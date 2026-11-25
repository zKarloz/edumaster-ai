// Contratos de UI del incremento v30.3 sin abrir una sesión real.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.join(__dirname, '../src');
const read = file => fs.readFileSync(path.join(root,file), 'utf8');

test('la rúbrica permite editar criterios y emplea modal compartido', () => {
  const code = read('modules/academic/TaskRubricPanel.tsx');
  assert.match(code, /export function TaskRubricPanel/);
  assert.match(code, /export function TaskGradePanel/);
  assert.match(code, /import \{ Modal \} from ['"]\.\.\/\.\.\/components\/shared\/Modal['"]/);
  assert.match(code, /\/rubric`/);
  assert.match(code, /expected_revision:grade\?\.revision \?\? 0/);
  assert.match(code, /\/my-grade`/);
});

test('editor y revisión usan la rúbrica compartida', () => {
  assert.match(read('modules/academic/CourseTaskPage.tsx'), /<TaskRubricPanel/);
  assert.match(read('modules/academic/TaskSubmissionReviewPage.tsx'), /<TaskGradePanel/);
  assert.match(read('modules/academic/TaskSubmissionsPage.tsx'), /official_score/);
});

test('el desplegable deja altura suficiente a tres opciones completas', () => {
  const code = read('components/shared/OptionSelect.tsx');
  assert.match(code,/visibleRows \* 44 \+ 18/);
  assert.match(code,/Math\.min\(168/);
});

test('las nuevas pantallas no tienen errores de sintaxis TSX', () => {
  for (const file of ['modules/academic/TaskRubricPanel.tsx',
      'modules/academic/CourseTaskPage.tsx', 'modules/academic/TaskSubmissionReviewPage.tsx',
      'modules/academic/TaskSubmissionsPage.tsx', 'components/shared/OptionSelect.tsx']) {
    const parsed=ts.transpileModule(read(file),{ fileName:file,reportDiagnostics:true,
      compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}});
    assert.deepEqual(parsed.diagnostics?.map(d => d.messageText),[],file);
  }
});
