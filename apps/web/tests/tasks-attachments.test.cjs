// Las reglas visuales no sustituyen la autorización de FastAPI.
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
const {hasSubmissionContent}=moduleRef.exports;
test('acepta respuesta textual sin archivos',()=>{
  assert.equal(hasSubmissionContent('Explicación',0),true);
});
test('acepta archivos sin texto',()=>{
  assert.equal(hasSubmissionContent(' ',1),true);
});
test('rechaza intento sin texto ni archivos',()=>{
  assert.equal(hasSubmissionContent('  ',0),false);
});
test('no permite recuentos inválidos',()=>{
  assert.equal(hasSubmissionContent('',-1),false);
  assert.equal(hasSubmissionContent('',1.5),false);
});
