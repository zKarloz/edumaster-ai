// Contratos de interfaz del popup: conservar ceros y no mostrar datos no autorizados.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const src = fs.readFileSync(path.join(__dirname, '../src/modules/organizations/InstitutionMap.tsx'), 'utf8');
test('popup institucional sustituye el enlace por totales y conserva selección', () => {
  assert.doesNotMatch(src, /legacy\.k140bbf9e62/);
  assert.match(src, /org\.enrollment_count != null && org\.student_count != null/);
  assert.match(src, /format\.format\(org\.enrollment_count\)/);
  assert.match(src, /format\.format\(org\.student_count\)/);
  assert.match(src, /click: \(\) => onSelect\(org\.id\)/);
  assert.match(src, /normalizeLocale\(i18n\.language\)/);
});
