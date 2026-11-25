/** Regresiones del directorio tras una recarga y del CSV en página completa.
 * Tests de contrato sin llamadas reales ni envíos de invitaciones.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const src = file => fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8');

test('la institución activa se resuelve cuando las organizaciones llegan después del login', () => {
  const panel = src('src/modules/users/UserProvisioningPanel.tsx');
  assert.match(panel, /organizations\.some\(org => org\.id === orgId\)/);
  assert.match(panel, /organizations\[0\]\?\.id/);
  assert.doesNotMatch(panel, /useState\(organizationId \|\| organizations\[0\]/);
  assert.match(panel, /\[globalAdmin, ready, activeOrg, token, reload\]/);
});
test('el directorio se muestra aun si la primera respuesta fue una lista vacía', () => {
  const panel = src('src/modules/users/UserProvisioningPanel.tsx');
  assert.match(panel, /globalAdmin && <div className="space-y-2">/);
  assert.match(panel, /ready && <DataTable label="Directorio de usuarios por institución"/);
  assert.match(panel, /directoryLoading/);
});
test('la importación CSV usa ruta profunda y una página en Usuarios', () => {
  const panel = src('src/modules/users/UserProvisioningPanel.tsx');
  const routes = src('src/routes.ts');
  const app = src('src/App.tsx');
  assert.match(panel, /navigate\(usersCsvImportPath\(activeOrg\)\)/);
  assert.match(routes, /importar-csv/);
  assert.match(routes, /if \(isUsersCsvImportPath\(path\)\) return 'users'/);
  assert.match(app, /<UsersCsvImportPage/);
  assert.match(app, /!usersCsvImportRoute/);
});
test('la vista previa CSV usa DataTable compartida y no envía invitaciones', () => {
  const file = src('src/modules/users/UsersCsvImportPage.tsx');
  assert.match(file, /<DataTable label="Vista previa del CSV"/);
  assert.match(file, /\/preview`/);
  assert.match(file, /\/import`/);
  assert.match(file, /setImportStarted\(true\)/);
  assert.match(file, /disabled=\{!confirmed \|\| busy\}/);
});
test('las tablas locales ofrecen 5, 10 y 20 filas, comenzando siempre con 5', () => {
  const table = src('src/components/shared/DataTable.tsx');
  assert.match(table, /useState<5 \| 10 \| 20>\(5\)/);
  assert.match(table, /\[5, 10, 20\]/);
  assert.match(table, /setPage\(0\)/);
  assert.match(table, /manualMode/);
  assert.match(table, /<OptionSelect/);
});
