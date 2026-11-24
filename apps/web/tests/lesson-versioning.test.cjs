// Reglas puras de v29.3: no se requiere navegador ni Supabase para estas pruebas.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const source=fs.readFileSync(require('node:path').join(__dirname,'../src/modules/academic/lessonVersioning.ts'),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const targetModule={exports:{}};
vm.runInNewContext(compiled,{exports:targetModule.exports,module:targetModule,URL});
const {canPublishRevision,safeCourseResourceUrl}=targetModule.exports;

test('no publica sin borrador',()=>assert.equal(canPublishRevision(false,false,false,false),false));
test('no publica con cambios sin guardar',()=>assert.equal(canPublishRevision(true,true,false,false),false));
test('no publica durante guardado ni publicación',()=>{
  assert.equal(canPublishRevision(true,false,true,false),false);
  assert.equal(canPublishRevision(true,false,false,true),false);
});
test('publica solo un borrador guardado',()=>assert.equal(canPublishRevision(true,false,false,false),true));
test('acepta URL firmada privada del origen configurado',()=>{
  assert.equal(safeCourseResourceUrl('https://project.supabase.co/storage/v1/object/sign/course-resources/abc?token=x',
    'https://project.supabase.co'),'https://project.supabase.co/storage/v1/object/sign/course-resources/abc?token=x');
});
test('rechaza enlaces externos y objetos públicos',()=>{
  assert.throws(()=>safeCourseResourceUrl('https://evil.example/storage/v1/object/sign/course-resources/x','https://project.supabase.co'));
  assert.throws(()=>safeCourseResourceUrl('https://project.supabase.co/storage/v1/object/public/course-resources/x','https://project.supabase.co'));
});
test('no acepta URL sin configurar Supabase',()=>{
  assert.throws(()=>safeCourseResourceUrl('https://project.supabase.co/storage/v1/object/sign/course-resources/x',undefined));
});
