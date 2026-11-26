/** Contratos de integración de la bandeja; no sustituyen las pruebas de navegador. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'../src',p),'utf8');
test('campana antes de la cuenta y aislada por sesión',()=>{
 const app=read('App.tsx');assert.match(app,/<NotificationInbox key=\{`notifications:\$\{session\.user\.id\}`\} token=\{accessToken\}\/>\}/);assert.ok(app.indexOf('<NotificationInbox')<app.indexOf('<AccountMenu'));
});
test('consulta privada y limpieza de temporizadores',()=>{
 const inbox=read('components/shared/NotificationInbox.tsx');
 for(const value of ['Authorization','60000','visibilityState','clearInterval','request.current?.abort()','mutation.current?.abort()','read-all','aria-expanded','inert={!open}'])assert.ok(inbox.includes(value),value);
});
test('navegación a recomendación específica',()=>{
 const inbox=read('components/shared/NotificationInbox.tsx');const rec=read('modules/academic/TeacherRecommendations.tsx');
 assert.match(inbox,/courseOfferingPath\(item.organization_id,item.offering_id\)/);assert.match(inbox,/tab=recommendations&recommendation=/);assert.match(rec,/data.items.find\(r=>r.id===focus\)/);assert.match(rec,/if\(item\)setSelected\(item\)/);
});

test("claves distintas para hermanos del topbar",()=>{const app=read("App.tsx");assert.ok(app.includes("<NotificationInbox key={`notifications:${session.user.id}`}"));assert.ok(app.includes("<AccountMenu key={`account:${session.user.id}`}"));});
