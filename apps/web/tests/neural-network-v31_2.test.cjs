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
const trained = source('src/modules/intelligence/components/TrainedNetwork.tsx');
const visual = source('src/modules/intelligence/NeuralNetworkVisualizer.tsx');
const config = source('src/modules/intelligence/neuralNetworkConfig.ts');
const routes = source('src/routes.ts');
const app = source('src/App.tsx');
const css = source('src/styles.css');

test('la ruta del visualizador es estable y se reconoce al actualizar el navegador', () => {
  assert.match(routes, /intelligence:\s*'\/inteligencia-artificial\/red-neuronal'/);
  assert.match(app, /section === 'intelligence'/);
  assert.match(app, /<NeuralNetworkPage token=\{accessToken\?\?undefined\} canRegister=/);
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

test('el modelo entrenado permite seleccionar neuronas por teclado y clic', () => {
  assert.match(trained, /role="button" tabIndex=\{0\}/);
  assert.match(trained, /onClick=\{\(\)=>chooseNode\(l,i\)\}/);
  assert.match(trained, /e.key==='Enter'\|\|e.key===' '/);
});

test('solo la entrada seleccionada se destaca y las demás se atenúan visualmente', () => {
  assert.match(visual, /const faded = !isGeneral && !focused/);
  assert.match(visual, /data-dimmed=\{faded\}/);
  assert.match(visual, /selected === source\.id/);
  assert.match(css, /\.neural-input-button\[data-dimmed='true'\]/);
});

test('la animación del modelo entrenado recorre las etapas y permite repetir', () => {
  assert.match(trained, /PHASE_DURATION_MS/);
  assert.match(trained, /setPhase\(p=>p\+1\)/);
  assert.match(trained, /phase>=last/);
  assert.match(trained, /setPlaying\(p=>!p\)/);
  assert.match(trained, /function replay\(\)/);
  assert.match(trained, /window\.clearTimeout\(timer\)/);
  assert.match(trained, /<animateMotion/);
});

test('la vista general recupera el enfoque sin llamadas a API', () => {
  assert.match(trained, /setNode\(null\);setEdge\(null\);setGroup\(null\);replay\(\)/);
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
  assert.match(trained, /SYNTHETIC DEMO/);
  assert.match(page, /Entrena o recupera un modelo DEMO/);
});
