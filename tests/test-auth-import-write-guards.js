const { spawnSync } = require('child_process');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const emptyFixture = path.join('tests', 'fixtures', 'auth-access-empty-sheet.json');
const duplicateConflictFixture = path.join('tests', 'fixtures', 'auth-access-duplicate-conflict-sheet.json');

function runWriteGuard(fixture) {
  return spawnSync(
    process.execPath,
    ['scripts/import-sheets-to-db.mjs', '--domain=auth', `--fixture=${fixture}`, '--write', '--disable-missing'],
    {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...process.env,
        DATABASE_URL: 'postgresql://placeholder:placeholder@localhost:5432/placeholder?sslmode=require',
        GOOGLE_SHEETS_AUTH_ID: '',
        GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: '',
      },
    },
  );
}

const emptyResult = runWriteGuard(emptyFixture);

assert.notStrictEqual(emptyResult.status, 0, 'empty or invalid auth import writes should fail closed.');
assert.match(
  `${emptyResult.stdout}\n${emptyResult.stderr}`,
  /No valid auth rows parsed; refusing to write\./,
  'empty or invalid auth import writes should fail before DB writes.',
);

const duplicateResult = runWriteGuard(duplicateConflictFixture);

assert.notStrictEqual(duplicateResult.status, 0, 'conflicting duplicate auth import writes should fail closed.');
assert.match(
  `${duplicateResult.stdout}\n${duplicateResult.stderr}`,
  /Conflicting duplicate auth email rows were found; fix the Sheet before writing\./,
  'conflicting duplicate auth import writes should fail before DB writes.',
);

[
  emptyResult,
  duplicateResult,
].forEach((result) => {
  [
    'external.only@example.com',
    'not-an-email',
    'conflict.alpha@rtu.edu.ph',
  ].forEach((email) => {
    assert.ok(!result.stdout.includes(email), `write guard stdout must not include ${email}`);
  });
});

console.log('test-auth-import-write-guards: PASS');
