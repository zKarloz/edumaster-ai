/**
 * Contratos de regresión del visualizador conceptual.
 * Tests offline: no se necesitan credenciales, API, base de datos ni modelo ML.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = name => fs.readFileSync(path.resolve(__dirname, '..', name), 'utf8');
const page = source('src/modules/intelligence/NeuralNetworkPage.tsx');
const visual = source('src/modules/intelligence/NeuralNetworkVisualizer.tsx');
const config = source('src/modules/intelligence/neuralNetworkConfig.ts');
const routes = source('src/routes.ts');
const app = source('src/App.tsx');
const css = source('src/styles.css');

test('la ruta del visualizador es estable y se reconoce al actualizar el navegador', () => {
  assert.match(routes, /intelligence:\s*'\/inteligencia-artificial\/red-neuronal'/);
  assert.match(app, /section === 'intelligence'/);
  assert.match(app, /<NeuralNetworkPage\s*\/>/);
  assert.match(app, /id: 'intelligence'/);
  assert.match(source('src/i18n.ts'), /intelligence:'Neural network'/);
});

test('las seis entradas tienen identificadores estables y texto localizado', () => {
  for (const id of ['platform','performance','participation','interactions','attendance','comments']) {
    assert.match(config, new RegExp(`id:'${id}'`));
  }
  for (const locale of ['es:', 'en:', 'pt:']) assert.ok(config.includes(locale));
});

test('la arquitectura muestra seis salidas y dos capas ocultas', () => {
  for (const id of ['recommendations','paths','alerts','predictions','progress','certificates']) {
    assert.match(config, new RegExp(`id:'${id}'`));
  }
  assert.match(visual, /Array\.from\(\{length:5\}/);
  assert.match(visual, /Array\.from\(\{length:4\}/);
  assert.match(visual, /NEURAL_OUTPUTS\.map/);
});

test('el usuario puede seleccionar la neurona mediante botón o teclado', () => {
  assert.match(page, /aria-pressed=\{selected === input\.id\}/);
  assert.match(page, /onClick=\{\(\) => selectInput\(input\.id\)\}/);
  assert.match(visual, /role="button" tabIndex=\{0\}/);
  assert.match(visual, /event\.key === 'Enter' \|\| event\.key === ' '/);
  assert.match(visual, /onSelect\(node\.id\)/);
});

test('solo la entrada seleccionada se destaca y las demás se atenúan visualmente', () => {
  assert.match(visual, /const faded = !isGeneral && !focused/);
  assert.match(visual, /data-dimmed=\{faded\}/);
  assert.match(visual, /selected === source\.id/);
  assert.match(css, /\.neural-input-button\[data-dimmed='true'\]/);
});

test('la animación recorre las tres etapas y se puede pausar o repetir', () => {
  assert.match(page, /const PHASE_DURATION_MS = 850/);
  assert.match(page, /setPhase\(previous => Math\.min\(3, previous \+ 1\)\)/);
  assert.match(page, /if \(selected === null \|\| !playing \|\| phase >= 3\) return/);
  assert.match(page, /setPlaying\(value => !value\)/);
  assert.match(page, /function replay\(\)/);
  assert.match(page, /window\.clearTimeout\(timer\)/);
  assert.match(visual, /<animateMotion path=/);
  assert.match(css, /stroke-dasharray: none/);
});

test('la vista general recupera las entradas sin navegación ni llamadas a API', () => {
  assert.match(page, /function showAll\(\)/);
  assert.match(page, /setSelected\(null\)/);
  assert.doesNotMatch(page, /\bfetch\s*\(|\/api\/v1\/|\bsupabase\s*\./i);
});

test('el usuario puede desactivar animaciones y se respeta reduced-motion', () => {
  assert.match(page, /animationsEnabled/);
  assert.match(page, /prefers-reduced-motion: reduce/);
  assert.match(css, /html\[data-motion='off'\] \.neural-edge/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

test('el diseño adapta los tres temas y mantiene desplazamiento horizontal móvil', () => {
  assert.match(css, /:root \{\s*--neural-scene:/);
  assert.match(css, /html\.dark:not\(\.black-theme\) \{/);
  assert.match(css, /html\.black-theme \{/);
  assert.match(css, /\.neural-graph-scroll \{[\s\S]*?overflow-x: auto;/);
  assert.match(css, /html\.black-theme \.neural-input-button\[data-selected='true'\]/);
});

test('la demostración nunca simula una predicción real ni certifica estudiantes', () => {
  assert.match(config, /no representa pesos aprendidos/i);
  assert.match(config, /no se consultan alumnos, notas reales, Supabase/);
  assert.match(config, /No se otorgan certificaciones/);
  assert.match(page, /\{labels\.badge\}/);
  assert.match(page, /\{labels\.illustration\}/);
});
