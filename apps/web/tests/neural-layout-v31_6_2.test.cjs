/** Contratos de presentación: arquitectura única, gráfico amplio y movimiento opcional. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'../src',p),'utf8');
const root='modules/intelligence/';
test('Arquitectura muestra únicamente el modelo real o accesos de preparación',()=>{
 const page=read(root+'NeuralNetworkPage.tsx');
 assert.doesNotMatch(page,/Vista conceptual|NeuralNetworkVisualizer|setMode/);
 assert.match(page,/result \? <TrainedNetwork/);
 assert.match(page,/setTab\('training'\)/);assert.match(page,/setTab\('models'\)/);
 assert.equal((page.match(/<LocalTrainingPanel\b/g)||[]).length,1);
});
test('gráfico mantiene tamaño, scroll interno, contornos temáticos y movimiento opcional',()=>{
 const chart=read(root+'components/ExperimentDetails.tsx'),css=read('styles.css');
 assert.match(chart,/Math.max\(760,76\+history.length\*34\)/);
 assert.match(chart,/height=320/);assert.match(chart,/style=\{\{minWidth:width\}\}/);
 assert.match(chart,/neural-loss-scroll min-w-0 overflow-x-auto rounded-xl border border-\[var\(--app-control-border\)\]/);
 assert.match(chart,/onPointerEnter/);assert.match(chart,/onFocus/);assert.match(chart,/onPointerDown/);
 assert.match(chart,/pathLength=\{1\}/);assert.match(css,/animation: neural-loss-draw/);
 assert.match(css,/html\[data-motion='off'\] \.neural-loss-segment/);
 assert.match(css,/@media \(prefers-reduced-motion: reduce\) \{\s*\.neural-loss-segment/);
 assert.match(read(root+'components/LocalTrainingPanel.tsx'),/neural-epoch-value/);
});
