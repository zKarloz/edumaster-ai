/** Regresiones de integración y reutilización visual. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'../src',p),'utf8');
test('comunidad exclusiva de ofertas',()=>{
 const page=read('modules/academic/CourseWorkspacePage.tsx');
 assert.match(page,/offeringId&&<button role="tab" aria-selected=\{tab==='community'\}/);
 assert.match(page,/tab==='community' && offeringId/);
});
test('comunidad reutiliza componentes y controles temáticos',()=>{
 const panel=read('modules/academic/CourseCommunity.tsx');
 for(const name of ['Modal','Spinner','useToast','--app-panel-border','Authorization','AbortController'])assert.ok(panel.includes(name));
 assert.doesNotMatch(panel,/dangerouslySetInnerHTML/);
 assert.match(panel,/data\.editor&&/);
 assert.match(panel,/data\.writable/);
});

test('comunidad pagina desde servidor y usa perfil académico mínimo',()=>{
 const panel=read('modules/academic/CourseCommunity.tsx');
 for(const text of ['page_size=${pageSize}','[5,10,20]','UserAvatar','useAvatar','OptionSelect','setProfile(p)','setProfile(c)'])assert.ok(panel.includes(text),text);
 assert.doesNotMatch(panel,/directory\/users|UserDetailModal/);
});

test('perfil académico comparte diseño administrativo sin consultar directorio',()=>{
 const profile=read('modules/academic/AcademicParticipantProfile.tsx');
 const modal=read('modules/users/UserDetailModal.tsx');
 assert.match(modal,/export function UserProfileLayout/);
 assert.match(profile,/<UserProfileLayout/);
 assert.match(profile,/community\/participants/);
 assert.doesNotMatch(profile,/directory\/users|data\.email/);
 assert.match(read('modules/academic/CourseCommunity.tsx'),/<AcademicProfileModal/);
 assert.match(read('modules/academic/CourseWorkspacePage.tsx'),/offeringId && <AssignedInstructor/);
});
