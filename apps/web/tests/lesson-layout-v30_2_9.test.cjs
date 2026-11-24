/** CAMBIOS 21 v30.2.9: ancho compartido y modal sin mutaciones del scroll raíz. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = file => fs.readFileSync(path.join(__dirname, '../src', file), 'utf8');

// Cursos está dentro de <main class="app-content-container"> sin max-width local.
test('Editor y Nueva lección usan la misma anchura del contenedor de Cursos', () => {
  const app = read('App.tsx');
  const course = read('modules/academic/CourseWorkspacePage.tsx');
  const editor = read('modules/academic/LessonEditorPage.tsx');
  const create = read('modules/academic/LessonCreatePage.tsx');
  assert.match(app, /<main key=\{section\} className="module-enter mx-auto w-full app-content-container/);
  assert.match(course, /return <div className="space-y-5">/);
  assert.match(editor, /className="app-lesson-page w-full space-y-4"/);
  assert.match(create, /return <section className="w-full space-y-4">/);
  assert.doesNotMatch(editor, /app-lesson-page[^"\n]*max-w-(5xl|6xl|7xl)/);
  assert.doesNotMatch(create, /<section className="[^"]*max-w-(5xl|6xl|7xl)/);
});

test('Los botones para volver comparten el borde izquierdo del contenedor', () => {
  const editor = read('modules/academic/LessonEditorPage.tsx');
  const create = read('modules/academic/LessonCreatePage.tsx');
  const course = read('modules/academic/CourseWorkspacePage.tsx');
  assert.match(editor, /app-lesson-page w-full space-y-4[\s\S]*?<button type="button" className="app-secondary-button/);
  assert.match(create, /return <section className="w-full space-y-4">\s*<button type="button" className="app-secondary-button/);
  assert.match(course, /return <div className="space-y-5">[\s\S]*?<button className=\{secondary\}/);
});

test('Los modales usan el componente compartido y no cambian overflow del documento', () => {
  const modal = read('components/shared/Modal.tsx');
  const backdrop = read('components/shared/ModalBackdrop.tsx');
  const editor = read('modules/academic/LessonEditorPage.tsx');
  assert.match(modal, /createPortal\(/);
  assert.match(modal, /<ModalBackdrop/);
  assert.match(editor, /<Modal open=\{publishConfirm!==null\}/);
  assert.doesNotMatch(modal, /\b(?:html|body)\.style\.overflow\s*=/);
  assert.match(backdrop, /overflow-y-auto overscroll-contain/);
});

test('El sidebar sticky no se redimensiona por reglas condicionales del modal', () => {
  const css = read('styles.css');
  const app = read('App.tsx');
  assert.doesNotMatch(css, /html:has\(\.app-modal-overlay\)\s+\.app-sidebar/);
  assert.match(css, /\.app-modal-overlay,\s*\.app-modal-content\s*\{\s*overscroll-behavior:\s*contain;/);
  assert.match(css, /\.app-sidebar\s*\{\s*align-self:\s*flex-start;/);
  assert.match(app, /app-sidebar app-mobile-drawer fixed inset-y-0 left-0/);
  assert.match(app, /md:sticky md:top-0/);
});
