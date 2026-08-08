const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const schema = read('prisma/schema.prisma');
const migration = read('prisma/migrations/20260806000000_directory_logo_management/migration.sql');
const repository = read('lib/directory-repository.ts');
const exporter = read('lib/directory-export.ts');
const adminPage = read('app/services/admin/directory/page.tsx');
const correction = read('components/DirectoryCorrectionGuidance.tsx');
const envExample = read('.env.example');

assert(/directoryKey\s+String\s+@unique/.test(schema), 'DirectoryEntry should have a stable unique key.');
assert(schema.includes('model DirectoryLogo'), 'schema should include DirectoryLogo metadata.');
assert(/directoryEntryId\s+String\s+@unique/.test(schema), 'only one active logo should exist per entry.');
assert(schema.includes('model DirectoryExportState'), 'schema should track export retry state.');
assert(migration.includes('DROP VIEW IF EXISTS public_sheet_directory_entries'), 'directory export migration should replace the legacy view.');
assert(migration.includes('WHERE "enabled" = true'), 'directory export view should exclude disabled entries.');
assert(repository.includes('resolveDirectorySource'), 'directory reads should use a source switch.');
assert(repository.includes('db-with-sheets-fallback'), 'directory rollout fallback should remain explicit.');
assert(exporter.includes('FROM public_sheet_directory_entries'), 'export should read the sanitized view only.');
for (const privateField of ['trackingTokenHash', 'studentEmail', 'complaintNarrative', 'payloadJson']) {
  assert(!exporter.includes(privateField), `directory exporter must not reference ${privateField}.`);
}
assert(exporter.includes('clearSheetData') && exporter.includes('ensureSpreadsheetTab'), 'export should clear stale rows and create its tab when needed.');
assert(adminPage.includes('/api/admin/directory') && adminPage.includes('image/png,image/jpeg,image/webp'), 'admin UI should use the protected logo API and raster-only input policy.');
assert(correction.includes('NEXT_PUBLIC_DIRECTORY_CORRECTIONS_EMAIL'), 'correction guidance should use configured public email.');
assert(correction.includes('organization name') && correction.includes('incorrect field') && correction.includes('corrected information'), 'correction guidance should state the required details.');
assert(!correction.includes('fetch(') && !correction.includes('/api/'), 'correction guidance must remain informational with no report backend.');
assert.match(envExample, /^DIRECTORY_SOURCE="sheet"$/m, 'env example should default directory reads to the legacy Sheet source during rollout.');
assert(repository.includes("'db-with-sheets-fallback'"), 'repository should document the other directory source modes.');
assert.match(envExample, /^NEXT_PUBLIC_DIRECTORY_CORRECTIONS_EMAIL=""$/m, 'env example should document the correction email.');

console.log('test-directory-management-contract: PASS');
