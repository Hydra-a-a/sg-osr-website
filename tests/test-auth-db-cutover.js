const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const auth = read('lib/auth.ts');
const authAccess = read('lib/auth-access.ts');
const importer = read('scripts/import-sheets-to-db.mjs');
const envExample = read('.env.example');
const packageJson = JSON.parse(read('package.json'));

assert.ok(envExample.includes('AUTH_ACCESS_SOURCE="sheets"'), 'auth access source should default to sheets in .env.example.');
assert.ok(auth.includes('loadAuthorizedUsers'), 'auth callback should use the auth access repository.');
assert.ok(auth.includes('recordAuthorizedUserAccess'), 'auth callback should delegate last-access writes through the repository.');
assert.ok(auth.includes('CACHE_TTL = 5 * 60 * 1000'), 'auth authorized-user cache should stay bounded at 5 minutes.');
assert.ok(auth.includes('token.role = userData.role'), 'auth callback should keep role assignment from authorized-user source.');
assert.ok(!auth.includes("from '@/lib/sheets'"), 'auth callback should not directly depend on Sheets helpers after repository extraction.');

assert.ok(authAccess.includes("import 'server-only'"), 'auth access repository must be server-only.');
assert.ok(authAccess.includes("return 'sheets'"), 'auth access source resolver should default to Sheets.');
assert.ok(authAccess.includes("'db-with-sheets-fallback'"), 'auth access source resolver should support DB with Sheets fallback.');
assert.ok(authAccess.includes('return false;'), 'auth access parser should fail closed on unknown access-enabled values.');
assert.ok(authAccess.includes('conflictingDuplicateEmails'), 'auth access parser should fail closed on conflicting duplicate emails.');
assert.ok(authAccess.includes("await import('@/lib/prisma')"), 'DB repository should import Prisma lazily.');
assert.ok(!/^import .*@\/lib\/prisma/m.test(authAccess), 'auth access repository must not import Prisma at module load time.');
assert.ok(authAccess.includes('isInstitutionalEmail'), 'auth access parser should reject invalid/non-RTU emails like the importer.');
assert.ok(authAccess.includes('loadAuthorizedUsersFromSheets'), 'auth access repository should retain Sheets loader.');
assert.ok(authAccess.includes('loadAuthorizedUsersFromDb'), 'auth access repository should provide DB loader.');
assert.ok(authAccess.includes('recordAuthorizedUserAccess'), 'auth access repository should update last access for selected source.');
assert.ok(authAccess.includes('parseAuthorizedUsersFromSheetRows'), 'auth access parser should be reusable for importer parity.');
assert.ok(authAccess.includes('loadAuthorizedUsersFromDbWithKnownEmails'), 'fallback mode should distinguish DB-known disabled/revoked users from Sheet-only users.');
assert.ok(authAccess.includes('dbResult.knownEmails'), 'fallback mode should merge Sheet users only when DB has no row for that email.');
assert.ok(authAccess.includes('Sheet fallback source unavailable; using DB auth access only'), 'fallback mode should keep DB auth usable if Sheets are unavailable.');

assert.ok(importer.includes("requestedDomains[0] === 'auth'"), 'Sheets importer should implement --domain=auth.');
assert.ok(importer.includes('--fixture'), 'auth importer should support fake fixture rows for safe local verification.');
assert.ok(importer.includes('isInstitutionalEmail'), 'auth importer should reject invalid/non-RTU emails.');
assert.ok(importer.includes('unknownAccessEnabledRows'), 'auth importer should count unknown access-enabled values.');
assert.ok(importer.includes('unknownRoleRows'), 'auth importer should count unknown auth roles.');
assert.ok(importer.includes('duplicateEmailConflicts'), 'auth importer should count conflicting duplicate auth emails.');
assert.ok(importer.includes('assertAuthWriteSafe'), 'auth importer should block unsafe auth writes.');
assert.ok(importer.includes('prisma.authorizedUser.upsert'), 'auth importer should upsert authorized users.');
assert.ok(importer.includes('disableMissing'), 'auth importer should expose explicit missing-user disable behavior.');
assert.ok(importer.includes('without logging private email addresses'), 'auth importer should document privacy-safe logging.');
assert.strictEqual(packageJson.scripts['db:import:auth:dry-run'], 'node scripts/import-sheets-to-db.mjs --domain=auth');
assert.strictEqual(packageJson.scripts['db:import:auth:write'], 'node scripts/import-sheets-to-db.mjs --domain=auth --write');
assert.strictEqual(packageJson.scripts['test:auth-import-write-guards'], 'node tests/test-auth-import-write-guards.js');

console.log('test-auth-db-cutover: PASS');
