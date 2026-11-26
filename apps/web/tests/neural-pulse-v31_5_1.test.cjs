/** Regresión estructural del pulso eléctrico y etiquetas legibles. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../src/modules/intelligence/components/TrainedNetwork.tsx'),'utf8');
test('pulso entrenado usa estela, brillo, núcleo y respeta el movimiento',()=>{
 for(const name of ['neural-signal-tail','neural-signal-glow','neural-signal-core','trained-neural-pulse-blur']) assert.ok(source.includes(name));
 assert.match(source,/repeatCount="1" rotate="auto"/);
 assert.match(source,/allowMotion&&playing&&focused&&stage===e.layer/);
 assert.match(source,/PHASE_DURATION_MS=PULSE_MAX_MS\+80/);
 assert.match(source,/setReplayKey\(k=>k\+1\)/);
});
test('activaciones tienen fondo opaco y texto claro sin capturar clics',()=>{
 assert.match(source,/function ActivationLabel/);
 assert.match(source,/fill="#0b1728"/);
 assert.match(source,/fill="#f1f5f9"/);
 assert.match(source,/l>0&&<ActivationLabel/);
 assert.match(source,/pointerEvents="none"/);
});
