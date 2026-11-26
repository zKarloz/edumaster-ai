const {test}=require('node:test');
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const run=expr=>JSON.parse(execFileSync(process.execPath,['--experimental-strip-types','-e',`const {resolveMapLayer,parseMapLayer,mapTilerUrl}=require(${JSON.stringify(path.join(__dirname,'../src/lib/mapLayers.ts'))});console.log(JSON.stringify(${expr}))`],{encoding:'utf8',stdio:['ignore','pipe','ignore']}));
test('automatic follows theme; all explicit selections remain independent',()=>{
 assert.deepEqual(run(`['light','dark','black'].map(t=>['auto','light','dark','satellite'].map(l=>resolveMapLayer(l,t)))`),[['light','light','dark','satellite'],['dark','light','dark','satellite'],['dark','light','dark','satellite']]);
 assert.equal(run(`parseMapLayer('bad')`),'auto');
 assert.equal(run(`parseMapLayer(null)`),'auto');
 assert.equal(run(`parseMapLayer('satellite')`),'satellite');
});
test('official XYZ endpoints encode key and preserve map and fallback',()=>{
 assert.equal(run(`mapTilerUrl('satellite','a+b')`),'https://api.maptiler.com/maps/hybrid-v4/256/{z}/{x}/{y}.png?key=a%2Bb');
 const src=fs.readFileSync(path.join(__dirname,'../src/modules/organizations/InstitutionMap.tsx'),'utf8');
 assert.match(src,/VITE_MAPTILER_API_KEY/);assert.match(src,/tileerror/);assert.match(src,/tile\.openstreetmap\.org/);assert.match(src,/resources\/logo\.svg/);assert.doesNotMatch(src,/<MapContainer[^>]*key=/);
});
