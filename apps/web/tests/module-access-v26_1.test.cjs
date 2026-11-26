/** Política de navegación probada por rol y contexto; no reemplaza pruebas del API. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
// Compatible con Node 22.16 y posteriores, sin dependencias npm.
const moduleAccess=(...args)=>JSON.parse(execFileSync(process.execPath,['--experimental-strip-types','-e',`const {moduleAccess}=require(${JSON.stringify(path.join(__dirname,'../src/lib/moduleAccess.ts'))}); console.log(JSON.stringify(moduleAccess(...${JSON.stringify(args)})))`],{encoding:'utf8',stdio:['ignore','pipe','ignore']}));
const member=(role,organization_id='a')=>({organization_id,roles:[role]});
const visible=(global,roles,org='a')=>Object.entries(moduleAccess(global,roles,org)).filter(([,allowed])=>allowed).map(([key])=>key).sort();
const common=['dashboard','profile','settings'];
for(const [role,extra] of Object.entries({
 institution_admin:['organizations','users','courses','students','enrollments','activity','intelligence','security'],
 coordinator:['organizations','courses','students','enrollments','activity'],
 instructor:['courses','activity'], student:['courses'], analyst:[], ml_engineer:['intelligence'],
})) test(`módulos para ${role}`,()=>assert.deepEqual(visible([], [member(role)]),[...common,...extra].sort()));
test('superadmin sin roles institucionales no obtiene gestión académica',()=>assert.deepEqual(visible(['superadmin'],[]),[...common,'organizations','users','courses','intelligence','security'].sort()));
test('roles múltiples no se trasladan entre instituciones',()=>{
 const memberships=[member('institution_admin'),member('student','b'),member('instructor','b')];
 const b=moduleAccess([],memberships,'b');
 assert.equal(b.users,false);assert.equal(b.students,false);assert.equal(b.enrollments,false);assert.equal(b.activity,true);assert.equal(b.organizations,true);
 assert.equal(moduleAccess([],memberships,'a').users,true);
 assert.equal(moduleAccess([],memberships,'').users,true);
 assert.equal(moduleAccess([],memberships,'other').courses,false);
});
test('cuenta sin roles conserva únicamente módulos personales',()=>assert.deepEqual(visible([],[]),common.sort()));
test('sidebar y rutas directas utilizan la misma política',()=>{
 const app=fs.readFileSync(path.join(__dirname,'../src/App.tsx'),'utf8');
 assert.match(app,/Boolean\(link && navigationAccess\[link.id\]\)/);
 assert.match(app,/const sectionPermissionDenied = !routeAccess\[section\]/);
 assert.match(app,/routeOrganizationId \? moduleAccess\(globalRoles, memberships, routeOrganizationId\)/);
 assert.match(app,/section === 'intelligence' && !sectionPermissionDenied/);
 assert.match(app,/section === 'security' && !sectionPermissionDenied/);
 assert.match(app,/section === 'enrollments'\) && !sectionPermissionDenied && accessToken && <AcademicPage/);
 assert.match(app,/if \(!visible.length\) return null/);
});
