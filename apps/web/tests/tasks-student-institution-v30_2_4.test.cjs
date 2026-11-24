// CAMBIOS 21 v30.2.4 · Contratos de ruta y aislamiento de contexto institucional.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const ts=require('typescript');
function fromSource(relative){
  const source=fs.readFileSync(path.join(__dirname,'../src',relative),'utf8');
  const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const moduleRef={exports:{}};
  vm.runInNewContext(compiled,{exports:moduleRef.exports,module:moduleRef,RegExp,Error,Array});
  return moduleRef.exports;
}
const {myTaskSubmissionsPath,myTaskSubmissionsDetail,sectionForPath,taskSubmissionsDetail}=fromSource('routes.ts');
const {maySelectAcademicInstitution,chooseAcademicInstitution}=fromSource('lib/institutionContext.ts');
const org='11111111-1111-4111-8111-111111111111';
const other='22222222-2222-4222-8222-222222222222';
const offering='33333333-3333-4333-8333-333333333333';
const task='44444444-4444-4444-8444-444444444444';
test('Mis entregas tiene URL propia, no se confunde con el listado docente',()=>{
  const url=myTaskSubmissionsPath(org,offering,task);
  assert.equal(myTaskSubmissionsDetail(url).organizationId,org);
  assert.equal(myTaskSubmissionsDetail(url).offeringId,offering);
  assert.equal(myTaskSubmissionsDetail(url).taskId,task);
  assert.equal(taskSubmissionsDetail(url),null);
  assert.equal(sectionForPath(url),'courses');
  assert.equal(myTaskSubmissionsDetail(url.replace(task,'invalid')),null);
});
test('El selector de institución está disponible solo para roles de administración',()=>{
  assert.equal(maySelectAcademicInstitution([],[{organization_id:org,roles:['student']}]),false);
  assert.equal(maySelectAcademicInstitution([],[{organization_id:org,roles:['instructor']}]),false);
  assert.equal(maySelectAcademicInstitution([],[{organization_id:org,roles:['coordinator']}]),true);
  assert.equal(maySelectAcademicInstitution([],[{organization_id:org,roles:['institution_admin']}]),true);
  assert.equal(maySelectAcademicInstitution(['superadmin'],[]),true);
});
test('La preferencia guardada nunca selecciona instituciones no autorizadas',()=>{
  assert.equal(chooseAcademicInstitution([org],org,other,true),org);
  assert.equal(chooseAcademicInstitution([org],other,other,true),org);
  assert.equal(chooseAcademicInstitution([org,other],org,other,true),other);
  assert.equal(chooseAcademicInstitution([org,other],org,other,false),org);
  assert.equal(chooseAcademicInstitution([],org,org,true),'');
});
test('El historial del estudiante consulta únicamente su endpoint privado',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../src/modules/academic/MyTaskSubmissionsPage.tsx'),'utf8');
  assert.match(source,/\/my-submissions/);
  assert.match(source,/data\.role!==\x27student\x27/);
  assert.match(source,/rows\.find\(item=>item\.id===selectedId\)/);
  assert.doesNotMatch(source,/\/submissions\?limit/);
  const panel=fs.readFileSync(path.join(__dirname,'../src/modules/academic/CourseTasksPanel.tsx'),'utf8');
  const detail=fs.readFileSync(path.join(__dirname,'../src/modules/academic/CourseTaskPage.tsx'),'utf8');
  assert.match(panel,/navigate\(courseTaskPath\(/);
  assert.match(detail,/\/my-submissions/);
  assert.match(detail,/role==='editor'/);
  assert.match(detail,/<Modal open=\{confirmAction !== null\}/);
  assert.doesNotMatch(detail,/<Modal[^>]*title=\{t.send\}/); // Los envíos siguen en la página; solo acciones irreversibles usan modal.
  assert.doesNotMatch(panel,/<Modal/);
});
test('Los selectores institucionales duplicados se retiran de los módulos académicos',()=>{
  const academic=fs.readFileSync(path.join(__dirname,'../src/modules/academic/AcademicPage.tsx'),'utf8');
  const activity=fs.readFileSync(path.join(__dirname,'../src/modules/academic/AcademicActivityPage.tsx'),'utf8');
  const users=fs.readFileSync(path.join(__dirname,'../src/modules/users/InstitutionalUsersPage.tsx'),'utf8');
  assert.doesNotMatch(academic,/onOrganizationChange/);
  assert.doesNotMatch(activity,/onOrganizationChange/);
  assert.doesNotMatch(users,/onChange=\{setOrganizationId\}/);
});
