/* Pruebas unitarias del contrato editorial de React -> FastAPI.
 * Utiliza TypeScript del proyecto (dependencia de desarrollo) sin navegador.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');
const input = fs.readFileSync(path.join(__dirname,'../src/modules/academic/lessonDocument.ts'),'utf8');
const js = ts.transpileModule(input,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const exportsObject = {};
vm.runInNewContext(js,{exports:exportsObject,URL,Set,Number,Error}, {filename:'lessonDocument.cjs'});
const {canonicalLessonDocument: normalize} = exportsObject;

test('acepta un documento vacío y texto con marcas',()=>{
  const doc=normalize({type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Hola',marks:[{type:'bold'}]}]}]});
  assert.equal(doc.content[0].content[0].marks[0].type,'bold');
});
test('adapta atributos propios de OrderedList v3 al contrato del backend',()=>{
  const doc=normalize({type:'doc',content:[{type:'orderedList',attrs:{start:1,type:null},content:[{type:'listItem',content:[{type:'paragraph',content:[{type:'text',text:'Paso'}]}]}]}]});
  assert.equal(doc.content[0].attrs.start,1);
  assert.equal(Object.hasOwn(doc.content[0].attrs,'type'),false);
});
test('admite enlaces HTTPS y descarta atributos visuales no persistidos',()=>{
  const doc=normalize({type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Acceso',marks:[{type:'link',attrs:{href:'https://example.org/page',class:null,target:'_blank',rel:'noopener noreferrer nofollow'}}]}]}]});
  assert.equal(doc.content[0].content[0].marks[0].attrs.href,'https://example.org/page');
  assert.equal(Object.hasOwn(doc.content[0].content[0].marks[0].attrs,'class'),false);
});
test('bloquea enlaces HTTP o scripts',()=>{
  for(const url of ['javascript:alert(1)','http://example.org','https://user:pw@example.org']){
    assert.throws(()=>normalize({type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'x',marks:[{type:'link',attrs:{href:url}}]}]}]}));
  }
});
test('no descarta silenciosamente nodos sin soporte',()=>{
  assert.throws(()=>normalize({type:'doc',content:[{type:'image',attrs:{src:'https://example.org/p.png'}}]}));
});
