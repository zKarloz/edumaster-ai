// Regresión estructural: diseño público sin cambios en autenticación.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('Login conserva el formulario y utiliza fotografía local con respaldo',()=>{
  const login=read('src/LoginScreen.tsx');
  const showcase=read('src/modules/auth/LoginShowcase.tsx');
  for(const token of ['onSubmit={onSubmit}','onEmailChange(e.target.value)','onChange={onPasswordChange}','disabled={busy}','<Link to="/"','<LoginShowcase/>']) assert.ok(login.includes(token),token);
  assert.match(showcase,/src="\/images\/landing\/hero-students.jpg"/);
  assert.match(showcase,/onError=\{\(\)=>setFailed\(true\)\}/);
  assert.doesNotMatch(showcase,/supabase|fetch\(/i);
});
test('carrusel hacia la derecha, pausa y movimiento reducido',()=>{
  const css=read('src/styles.css');
  const showcase=read('src/modules/auth/LoginShowcase.tsx');
  assert.match(css,/login-cards-right 45s linear infinite/);
  assert.match(css,/from \{ transform: translateX\(-50%\); \} to \{ transform: translateX\(0\); \}/);
  assert.match(css,/login-carousel-paused \{ animation-play-state: paused/);
  assert.match(css,/html\[data-motion='off'\] \.login-carousel-track \{ animation: none/);
  assert.match(css,/@media \(prefers-reduced-motion: reduce\) \{\s*\.login-carousel-window/);
  assert.match(showcase,/aria-hidden=\{group===1\?true:undefined\}/);
  assert.match(showcase,/hidden pb-8 lg:block/);
});

test('fusión del fondo por tema y elevación accesible del carrusel',()=>{
  const css=read('src/styles.css');
  const login=read('src/LoginScreen.tsx');
  const showcase=read('src/modules/auth/LoginShowcase.tsx');
  assert.match(login,/app-shell login-shell/);
  assert.match(showcase,/login-showcase-background absolute inset-0/);
  assert.match(css,/mask-image: linear-gradient\(to right, #000 0%, #000 75%, transparent 100%\)/);
  for(const color of ['#f5f7fb','#06152b','#080808']) assert.ok(css.includes(`--login-surface: ${color}`));
  assert.match(css,/login-feature-card:hover \{\s*transform: translateY\(-5px\)/);
  assert.match(css,/html\[data-motion='off'\] \.login-feature-card \{ transition: none; transform: none/);
  assert.match(css,/padding-block: 12px 20px/);
});
