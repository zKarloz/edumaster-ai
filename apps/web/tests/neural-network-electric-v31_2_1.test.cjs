/**
 * Regresiones de CAMBIOS 23 v31.2.1: pulso eléctrico sobre líneas rectas.
 * Pruebas offline y sin acceso a cuentas ni a Supabase.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = file => fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8');
const visual = read('src/modules/intelligence/NeuralNetworkVisualizer.tsx');
const page = read('src/modules/intelligence/NeuralNetworkPage.tsx');
const css = read('src/styles.css');

test('la selección ya no crea el halo expandible alrededor de la neurona', () => {
  assert.doesNotMatch(visual, /neural-node-halo/);
  assert.doesNotMatch(css, /@keyframes neural-halo|\.neural-node-halo/);
  assert.doesNotMatch(css, /focus-visible \.neural-hit-area\s*\{/);
  assert.match(css, /neural-input-node:focus-visible \.neural-node-label/);
  assert.match(visual, /role="button" tabIndex=\{0\}/);
});

test('las conexiones de fondo son rectas y continuas, sin flujo discontinuo', () => {
  assert.match(visual, /<line key=\{`a-/);
  assert.match(visual, /<line key=\{`b-/);
  assert.match(visual, /<line key=\{`c-/);
  assert.match(css, /\.neural-edge \{[^}]*stroke-dasharray: none;/);
  assert.doesNotMatch(css, /stroke-dasharray: 8 12|@keyframes neural-flow/);
});

test('cada pulso tiene estela, brillo y movimiento de origen a destino', () => {
  assert.match(visual, /function SignalPulse\(/);
  assert.match(visual, /className="neural-signal-tail"/);
  assert.match(visual, /className="neural-signal-glow"/);
  assert.match(visual, /<animateMotion path=\{`M \$\{x1\}/);
  assert.match(visual, /repeatCount="indefinite" rotate="auto"/);
  assert.match(visual, /filter id="neural-pulse-blur"/);
});

test('los pulsos se muestran solo en las conexiones activas de cada etapa', () => {
  assert.match(visual, /\{playing && <g className="neural-signals"/);
  assert.match(visual, /activated\(1\) && NEURAL_INPUTS/);
  assert.match(visual, /source\.id === selected/);
  assert.match(visual, /activated\(2\) && Array\.from/);
  assert.match(visual, /activated\(3\) && Array\.from/);
  assert.match(visual, /relevant\.includes\(output\.id\)/);
});

test('el modelo entrenado conserva controles de pausa mientras propaga', () => {
  const trained = read('src/modules/intelligence/components/TrainedNetwork.tsx');
  assert.match(trained, /disabled=\{!allowMotion\|\|phase>=last\}/);
  assert.match(trained, /setPlaying\(p=>!p\)/);
});

test('sin movimiento se mantienen las líneas y se ocultan las partículas', () => {
  assert.match(page, /animationsEnabled && !systemReduced/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /html\[data-motion='off'\] \.neural-signals/);
  assert.match(css, /\.neural-signals \{ display: none !important; \}/);
});
