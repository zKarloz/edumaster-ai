// Contratos frontales puros: la autorización real permanece en FastAPI.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const ts=require('typescript');
const source=fs.readFileSync(path.join(__dirname,'../src/modules/academic/courseTaskRules.ts'),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const moduleRef={exports:{}};
vm.runInNewContext(compiled,{exports:moduleRef.exports,module:moduleRef,Date,Number,Error});
const {canSendTextSubmission,taskLocalDateToISO}=moduleRef.exports;
const now=Date.parse('2026-11-24T12:00:00Z');
test('solo admite envío cuando matrícula, oferta y tarea están habilitadas',()=>{
  assert.equal(canSendTextSubmission(true,false,'published',null,0,1,now),true);
  assert.equal(canSendTextSubmission(false,false,'published',null,0,1,now),false);
  assert.equal(canSendTextSubmission(true,true,'published',null,0,1,now),false);
});
test('no permite enviar borradores ni tareas cerradas',()=>{
  for(const status of ['draft','closed']){
    assert.equal(canSendTextSubmission(true,false,status,null,0,1,now),false);
  }
});
test('respeta límite de intentos y fecha UTC',()=>{
  assert.equal(canSendTextSubmission(true,false,'published',null,1,1,now),false);
  assert.equal(canSendTextSubmission(true,false,'published','2026-11-24T11:59:00Z',0,2,now),false);
  assert.equal(canSendTextSubmission(true,false,'published','2026-11-24T12:01:00Z',0,2,now),true);
});
test('fecha local se envía con zona y sin números inválidos',()=>{
  assert.equal(taskLocalDateToISO(''),null);
  assert.ok(taskLocalDateToISO('2026-11-25T10:30').endsWith('Z'));
  assert.throws(()=>taskLocalDateToISO('no es fecha'));
});
