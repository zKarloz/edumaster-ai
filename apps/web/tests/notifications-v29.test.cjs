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

test('avisos académicos usan rutas internas y enfocan Comunidad',()=>{
 const inbox=read('components/shared/NotificationInbox.tsx');
 for(const event of ['task_published','task_submitted','grade_issued','community_announcement','community_question','community_reply'])assert.ok(inbox.includes(event));
 assert.match(inbox,/taskSubmissionsPath\(item.organization_id,item.offering_id,item.target_id\)/);
 assert.match(inbox,/courseTaskPath\(item.organization_id,item.offering_id,item.target_id\)/);
 assert.match(inbox,/tab=community&post=/);
 assert.match(read('modules/academic/CourseCommunity.tsx'),/focus=\$\{encodeURIComponent\(focus\)\}/);
});

// Contratos del nuevo refresh y los destinos de los avisos operativos.
test('recordatorios y eventos administrativos conservan rutas autorizadas',()=>{
 const inbox=read('components/shared/NotificationInbox.tsx');
 for(const event of ['task_due_soon','task_grading_pending','enrollment_created','instructor_assigned'])assert.ok(inbox.includes(event));
 assert.ok(inbox.includes("fetch(`${API}/refresh`,{method:'POST'"));
 assert.match(inbox,/enrollmentHistoryPath\(item.organization_id,item.offering_id,item.target_id\)/);
 assert.match(inbox,/item.event_type==='instructor_assigned'\)navigate\(base\)/);
});
