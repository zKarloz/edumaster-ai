const {test}=require('node:test');
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const path=require('node:path');
const fs=require('node:fs');
const run=(expr)=>JSON.parse(execFileSync(process.execPath,['--experimental-strip-types','-e',`const {availableDashboardRoles,knownTotal}=require(${JSON.stringify(path.join(__dirname,'../src/modules/dashboard/dashboardScope.ts'))});console.log(JSON.stringify(${expr}))`],{encoding:'utf8',stdio:['ignore','pipe','ignore']}));
test('las vistas múltiples respetan la institución seleccionada',()=>{
 assert.deepEqual(run(`availableDashboardRoles(['superadmin'],[{organization_id:'a',roles:['institution_admin','instructor']},{organization_id:'b',roles:['student']}],'a')`),['superadmin','institution_admin','instructor']);
 assert.deepEqual(run(`availableDashboardRoles([],[{organization_id:'a',roles:['institution_admin']},{organization_id:'b',roles:['student']}],'b')`),['student']);
 assert.deepEqual(run(`availableDashboardRoles([],[{organization_id:'a',roles:['institution_admin']}],'')`),[]);
});
test('totales distinguen cero de información desconocida',()=>{
 assert.equal(run('knownTotal([0,2,3])'),5);assert.equal(run('knownTotal([0,null])'),null);assert.equal(run('knownTotal([0,undefined])'),null);assert.equal(run('knownTotal([])'),0);
});
test('dashboard utiliza datos autorizados y resumen financiero de la semilla compartida',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../src/modules/dashboard/DashboardPage.tsx'),'utf8');
 assert.match(source,/if\(!manager\|\|!props.token\|\|!props.organizationId\)return/);
 assert.match(source,/ctrl.signal.aborted/);assert.match(source,/seedIncome.filter/);assert.match(source,/props.access.income/);assert.match(source,/&&props.access\[s\]/);
 const app=fs.readFileSync(path.join(__dirname,'../src/App.tsx'),'utf8');assert.match(app,/<DashboardPage key=\{`\$\{session.user.id\}:\$\{academicOrgId\}`\}/);
});
