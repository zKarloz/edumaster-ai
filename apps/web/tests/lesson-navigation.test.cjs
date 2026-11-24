/* Reglas de navegación de lecciones: atrá/adelante, menú y salida limpia.
 * El comportamiento real del router se validará también en navegador.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname,'../src/modules/academic/lessonNavigation.ts'),'utf8');
const compiled = ts.transpileModule(source,{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText;
const output = {};
vm.runInNewContext(compiled,{exports:output},{filename:'lessonNavigation.cjs'});
const block = output.shouldBlockLessonNavigation;
const origin={pathname:'/academico/leccion/editar',search:'?unit=1',hash:''};

test('sin cambios no bloquea ninguna salida',()=>{
  assert.equal(block(false,false,origin,{...origin,pathname:'/inicio'}),false);
});
test('bloquea navegación del menú con borrador modificado',()=>{
  assert.equal(block(true,false,origin,{...origin,pathname:'/inicio'}),true);
});
test('bloquea Atrás/Adelante cuando cambia la URL',()=>{
  assert.equal(block(true,false,origin,{...origin,pathname:'/academico/cursos'}),true);
});
test('bloquea cambios de query y hash en el historial',()=>{
  assert.equal(block(true,false,origin,{...origin,search:'?unit=2'}),true);
  assert.equal(block(true,false,origin,{...origin,hash:'#otra-seccion'}),true);
});
test('no bloquea cuando la ubicación no cambia',()=>{
  assert.equal(block(true,false,origin,{...origin}),false);
});
test('permite salir tras confirmar cierre de sesión',()=>{
  assert.equal(block(true,true,origin,{...origin,pathname:'/iniciar-sesion'}),false);
});
