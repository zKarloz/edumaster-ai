/** Contratos de UI v30.2.8: separadores y ancho del editor compartidos en tres temas. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = (name) => fs.readFileSync(path.join(__dirname, '../src', name), 'utf8');

test('los recursos del borrador usan el divisor temático compartido', () => {
  const component = read('modules/academic/LessonResources.tsx');
  assert.match(component, /className="app-divider grid gap-3 border-t pt-4 md:grid-cols-2"/);
});

test('el visor publicado utiliza el mismo divisor temático', () => {
  const component = read('modules/academic/PublishedLessonView.tsx');
  assert.match(component, /className="app-divider space-y-2 border-t pt-3"/);
});

test('el divisor comparte los tokens de Claro, Oscuro y Negro', () => {
  const styles = read('styles.css');
  assert.match(styles, /\.app-divider\s*\{\s*border-color:\s*var\(--app-panel-border\)/);
  assert.match(styles, /:root\s*\{[\s\S]*?--app-panel-border:/);
  assert.match(styles, /html\.dark\s*\{[\s\S]*?--app-panel-border:/);
  assert.match(styles, /html\.black-theme\s*\{[\s\S]*?--app-panel-border:/);
});

test('edición y creación heredan el mismo ancho completo de Cursos', () => {
  const editor = read('modules/academic/LessonEditorPage.tsx');
  const create = read('modules/academic/LessonCreatePage.tsx');
  assert.match(editor, /app-lesson-page w-full space-y-4/);
  assert.match(create, /return <section className="w-full space-y-4"/);
});
