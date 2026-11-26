/** Regresión: la portada no reemplaza las rutas protegidas ni las invitaciones. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('la raiz es publica y /app conserva su alias privado',()=>{
  const routes=read('src/routes.ts');
  assert.match(routes,/if \(path === '\/app'\) return sectionPaths.dashboard/);
  assert.doesNotMatch(routes,/path === '\/' \|\|/);
  const app=read('src/App.tsx');
  assert.match(app,/if \(!accessGranted \|\| location.pathname === '\/'\) return/);
  assert.match(app,/location.pathname === '\/' && !inviteSetup/);
  assert.ok(app.indexOf('return <LandingPage')<app.indexOf('if (!session) return <LoginScreen'));
  assert.match(app,/navigate\('\/login', \{ replace: true \}\)/);
});
test('la portada usa los destinos correctos y conserva el regreso desde Login',()=>{
  const landing=read('src/modules/landing/LandingPage.tsx');
  assert.match(landing,/authenticated \? '\/inicio' : '\/login'/);
  assert.match(read('src/LoginScreen.tsx'),/<Link to="\/"/);
  assert.match(landing,/landingCopy\[locale\]/);
  assert.match(landing,/onError=\{\(\)=>setFailed\(true\)\}/);
  assert.doesNotMatch(landing,/https:\/\/images\.pexels/);
  const copy=read('src/modules/landing/landingCopy.ts');
  for(const locale of ['es','en','pt']) assert.match(copy,new RegExp(`\\b${locale}: \\{`));
});
