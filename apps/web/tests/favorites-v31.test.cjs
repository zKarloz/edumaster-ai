// Reglas puras y comprobaciones de integración sin navegador ni dependencias npm.
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const {execFileSync}=require('node:child_process');
const run=expr=>JSON.parse(execFileSync(process.execPath,['--experimental-strip-types','-e',`const m=require(${JSON.stringify(path.join(__dirname,'../src/modules/favorites/favoriteRules.ts'))});console.log(JSON.stringify(${expr}))`],{encoding:'utf8',stdio:['ignore','pipe','ignore']}));
const id='12345678-1234-1234-1234-123456789abc';const item={offeringId:id,kind:'content',title:'Curso'};const scope={userId:'a',organizationId:id,role:'student'};
test('favoritos validan identificadores, roles, duplicados y datos corruptos',()=>{
 const rows=[item,item,{...item,kind:'submissions',taskId:id},{...item,offeringId:'https://evil.example'},{...item,kind:'unknown'},null];
 assert.deepEqual(run(`m.parseFavorites(${JSON.stringify(JSON.stringify(rows))},'student')`),[item]);assert.deepEqual(run(`m.parseFavorites('broken','student')`),[]);
});
test('preferencias separadas por usuario, institución y rol; rutas internas tipadas',()=>{
 const keys=run(`[${JSON.stringify(scope)},${JSON.stringify({...scope,userId:'b'})},${JSON.stringify({...scope,organizationId:'other'})},${JSON.stringify({...scope,role:'instructor'})}].map(m.storageKey)`);assert.equal(new Set(keys).size,4);
 assert.equal(run(`m.favoritePath(${JSON.stringify(scope)},${JSON.stringify(item)})`),`/academico/organizaciones/${id}/ofertas/${id}?tab=content`);
 assert.equal(run(`m.favoritePath(${JSON.stringify(scope)},${JSON.stringify({...item,kind:'submissions',taskId:id})})`),`/academico/organizaciones/${id}/ofertas/${id}/tareas/${id}/entregas`);
});
test('orden, límite y alcance de roles efectivos',()=>{
 const items=[item,{...item,kind:'tasks'}];assert.deepEqual(run(`m.moveFavorite(${JSON.stringify(items)},0,1)`),items.reverse());
 assert.deepEqual(run(`m.matchingScopes(${JSON.stringify([scope,{...scope,role:'instructor'},{...scope,role:'coordinator'}])},'manager').map(x=>x.role)`),['coordinator']);
 assert.equal(run(`m.parseFavorites(JSON.stringify(Array.from({length:25},(_,i)=>({...${JSON.stringify(item)},offeringId:'12345678-1234-1234-1234-'+String(i).padStart(12,'0')}))),'student').length`),20);
});
test('estrella visible después de carga autorizada y destino revalidado antes de navegar',()=>{
 const src=p=>fs.readFileSync(path.join(__dirname,'../src',p),'utf8');
 assert.match(src('modules/academic/CourseWorkspacePage.tsx'),/!loading&&!error&&workspace&&offeringId&&<FavoriteStar/);
 assert.match(src('modules/favorites/Favorites.tsx'),/await verify\(scope,f,token,ctrl.signal\);if\(!ctrl.signal.aborted\)navigate/);
 assert.match(src('modules/favorites/Favorites.tsx'),/w.role!==expected/);assert.match(src('modules/dashboard/DashboardPage.tsx'),/role&&isFavoriteRole\(role\)/);
});
