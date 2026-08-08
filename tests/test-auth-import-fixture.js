const { execFileSync } = require('child_process');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const fixture = path.join('tests', 'fixtures', 'auth-access-sheet.json');

const output = execFileSync(
  process.execPath,
  ['scripts/import-sheets-to-db.mjs', '--domain=auth', `--fixture=${fixture}`],
  {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      GOOGLE_SHEETS_AUTH_ID: '',
      GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: '',
      DATABASE_URL: '',
    },
  },
);

const payload = JSON.parse(output.trim());

assert.strictEqual(payload.tool, 'import-sheets-to-db');
assert.strictEqual(payload.domain, 'auth');
assert.strictEqual(payload.dryRun, true);
assert.strictEqual(payload.writeApplied, false);
assert.strictEqual(payload.sourceTab, 'fixture-auth-access');
assert.deepStrictEqual(payload.summary, {
  rawDataRows: 8,
  sheetRowsWithEmail: 7,
  validEmailRows: 5,
  invalidEmailRows: 2,
  unknownAccessEnabledRows: 0,
  unknownRoleRows: 0,
  duplicateEmailRows: 1,
  duplicateEmailConflicts: 1,
  emptyOrNoEmailRows: 1,
  parsedUniqueEmails: 4,
  activeElevatedUsers: 2,
  activeLeaders: 0,
  activeOfficers: 2,
  disabledOrStudentRows: 2,
  lowestSheetRow: 3,
  highestSheetRow: 6,
});

[
  'leader.alpha@rtu.edu.ph',
  'officer.beta@rtu.edu.ph',
  'disabled.gamma@rtu.edu.ph',
  'student.delta@rtu.edu.ph',
  'external.echo@example.com',
  'not-an-email',
].forEach((email) => {
  assert.ok(!output.includes(email), `fixture importer output must not include ${email}`);
});

console.log('test-auth-import-fixture: PASS');
