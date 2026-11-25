// Contratos de invitaciones, importación y selección de institución.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const src = file => fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8');

test('el alta y la importación se integran con usuarios institucionales y globales', () => {
  for (const route of ['InstitutionalUsersPage', 'UsersPage']) {
    assert.match(src(`src/modules/users/${route}.tsx`), /<UserProvisioningPanel/);
  }
});
test('la invitación individual conserva el modal compartido y la selección de rol', () => {
  const file = src('src/modules/users/UserProvisioningPanel.tsx');
  assert.match(file, /import \{ Modal \}/);
  assert.match(file, /import \{ DataTable/);
  assert.match(file, /import \{ OptionSelect/);
  assert.match(file, /onChange\(\)/);
});
test('el CSV exige confirmación y se importa por lotes de 20 desde página propia', () => {
  const file = src('src/modules/users/UsersCsvImportPage.tsx');
  assert.match(file, /i \+= 20/);
  assert.match(file, /!confirmed/);
  assert.match(file, /previewCsv/);
  assert.doesNotMatch(file, /<Modal/);
});
test('el invitado define su contraseña sin enviarla a FastAPI', () => {
  const file = src('src/modules/users/InvitePasswordSetup.tsx');
  assert.match(file, /supabase\.auth\.updateUser/);
  assert.doesNotMatch(file, /fetch\(/);
  assert.match(src('index.html'), /edumaster:invite-setup/);
});
