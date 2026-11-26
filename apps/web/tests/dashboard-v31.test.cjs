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
 assert.match(source,/ctrl.signal.aborted/);assert.match(source,/seedIncome.filter/);assert.match(source,/props.access.income/);assert.match(source,/props.access.courses\?id=>navigate/);
 const app=fs.readFileSync(path.join(__dirname,'../src/App.tsx'),'utf8');assert.match(app,/<DashboardPage key=\{`\$\{session.user.id\}:\$\{academicOrgId\}`\}/);
});
test('Inicio académico limita ofertas propias y no mezcla recomendaciones de gestor',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../src/modules/dashboard/AcademicDashboard.tsx'),'utf8');
 assert.match(source,/activity\/offerings\?own=true/);
 assert.match(source,/my-courses\?current=true&limit=6/);
 assert.match(source,/if\(r.editor\)throw/);
 assert.match(source,/academic-pending/);
 assert.match(source,/taskSubmissionsPath\(organizationId,r.offering_id,r.target_id\)/);
 assert.match(source,/ctrl.signal.aborted/);
});
test('Inicio especializado conserva permisos y usa exclusivamente configuración DEMO',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../src/modules/dashboard/SpecialistDashboard.tsx'),'utf8');
 const page=fs.readFileSync(path.join(__dirname,'../src/modules/dashboard/DashboardPage.tsx'),'utf8');
 assert.match(source,/isSuperadmin&&token&&<AcademicReadiness/);
 assert.match(source,/if\(!canUseLab\)/);
 assert.match(source,/dataset\.splits\.train\.x\.length/);
 assert.match(page,/canUseLab=\{props.access.intelligence\}/);
 assert.match(page,/isSuperadmin=\{props.globalRoles.includes\('superadmin'\)\}/);
 const dataset=JSON.parse(fs.readFileSync(path.join(__dirname,'../src/modules/intelligence/ml/demoDataset.json'),'utf8'));
 assert.equal(dataset.classification,'SYNTHETIC_DEMO');
 assert.equal(dataset.columns.length,13);
 assert.deepEqual(['train','validation','test'].map(k=>dataset.splits[k].x.length),[150,50,50]);
});
const overviewRun=(fn,rows)=>JSON.parse(execFileSync(process.execPath,['--experimental-strip-types','-e',`const m=require(${JSON.stringify(path.join(__dirname,'../src/modules/dashboard/overviewCounts.ts'))});console.log(JSON.stringify(m[${JSON.stringify(fn)}](${JSON.stringify(rows)})))`],{encoding:'utf8',stdio:['ignore','pipe','ignore']}));
test('estado institucional no convierte datos desconocidos en cero',()=>{
 const organizationOverview=rows=>overviewRun('organizationOverview',rows);
 assert.deepEqual(organizationOverview([{status:'active',latitude:0,longitude:0,student_count:0},{status:'suspended',latitude:null,longitude:null,student_count:null}]),{active:1,suspended:1,archived:0,noLocation:1,noStudents:null});
 assert.equal(organizationOverview([{status:'active',latitude:0,longitude:0,student_count:0}]).noStudents,1);
});
test('atención académica excluye ofertas cerradas y canceladas',()=>{
 const offeringOverview=rows=>overviewRun('offeringOverview',rows);
 const rows=[{id:'a',status:'open',instructor_id:null,active_enrollments:0},{id:'b',status:'planned',instructor_id:'x',active_enrollments:0},{id:'c',status:'closed',instructor_id:null,active_enrollments:0},{id:'d',status:'cancelled',instructor_id:null,active_enrollments:0}];
 const result=offeringOverview(rows);assert.equal(result.noTeacher,1);assert.equal(result.noEnrollment,2);assert.deepEqual(result.attention.map(r=>r.id),['a','b']);
});
test('Inicio elimina accesos duplicados y usa columnas según contenido',()=>{
 const page=fs.readFileSync(path.join(__dirname,'../src/modules/dashboard/DashboardPage.tsx'),'utf8');
 assert.doesNotMatch(page,/const shortcuts|c\.quick/);assert.match(page,/grid items-start/);assert.match(page,/InstitutionSummary/);assert.match(page,/OfferingOverview/);
});
