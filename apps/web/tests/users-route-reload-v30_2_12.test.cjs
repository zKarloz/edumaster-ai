/** Contratos de regresión: URLs estables y encabezado CSV sin duplicaciones.
 * No se necesitan credenciales ni se envían invitaciones durante las pruebas.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = file => fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8');

test('Usuarios obtiene el permiso desde /me sin esperar el listado de instituciones', () => {
  const app = source('src/App.tsx');
  assert.match(app, /const canManageUserAdministration = globalRoles\.includes\('superadmin'\) \|\|\s*memberships\.some\(member => member\.roles\.includes\('institution_admin'\)\)/);
  assert.doesNotMatch(app, /const canManageUserAdministration =[^;]*institutionalAdminOrganizations\.length/);
});

test('recargar rutas validas no redirige a Resumen por una carga asincrona', () => {
  const app = source('src/App.tsx');
  const guard = app.match(/\/\/ Una ruta de módulo válida no debe perderse[\s\S]*?\}, \[location\.pathname, accessGranted, navigate\]\);/);
  assert.ok(guard, 'Debe existir un guard que preserve rutas reconocidas');
  assert.match(guard[0], /if \(!sectionForPath\(location\.pathname\) && !legacyRedirect\(location\.pathname\)\)/);
  assert.doesNotMatch(guard[0].slice(guard[0].indexOf('useEffect(')), /section === 'users'/);
  assert.match(source('src/routes.ts'), /if \(isUsersCsvImportPath\(path\)\) return 'users'/);
});

test('rutas restringidas muestran aviso y no montan los paneles de usuarios', () => {
  const app = source('src/App.tsx');
  assert.match(app, /const sectionPermissionDenied =/);
  assert.match(app, /\{sectionPermissionDenied && <section role="alert"/);
  assert.match(app, /section === 'users' && !sectionPermissionDenied && accessToken && usersCsvImportRoute/);
  assert.match(app, /section === 'users' && !sectionPermissionDenied && accessToken && !usersCsvImportRoute/);
  assert.match(app, /section === 'activity' && !sectionPermissionDenied && accessToken/);
});

test('importacion CSV usa solo el titulo del topbar y boton Volver alineado a la izquierda', () => {
  const app = source('src/App.tsx');
  const csv = source('src/modules/users/UsersCsvImportPage.tsx');
  assert.match(app, /usersCsvImportRoute \? 'Importar usuarios desde CSV'/);
  assert.doesNotMatch(csv, /<h2[^>]*>Importar usuarios desde CSV<\/h2>/);
  assert.doesNotMatch(csv, /Revisa los registros en una página completa antes de enviar invitaciones/);
  assert.match(csv, /<div className="flex justify-start">\s*<button[^>]*onClick=\{\(\) => navigate\(sectionPaths\.users\)\}/);
  assert.match(csv, /<DataTable label="Vista previa del CSV"/);
});
