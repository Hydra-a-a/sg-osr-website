const { assert } = require('./_security-baseline-helpers');

(async () => {
  const portal = await import('../lib/portal-mode.ts');

  const {
    deriveEffectivePortalRole,
    hasLeaderPrivilege,
    hasOfficerPrivilege,
    shouldShowLeaderAccessDeniedNotice,
    shouldShowOfficerAccessNotice,
  } = portal;

  const cases = [
    ['student', undefined, 'student'],
    ['student', 'leader', 'student'],
    ['student', 'officer', 'student'],
    ['leader', undefined, 'leader'],
    ['leader', 'student', 'student'],
    ['leader', 'officer', 'leader'],
    ['officer', undefined, 'leader'],
    ['officer', 'student', 'student'],
    ['officer', 'leader', 'leader'],
    ['officer', 'officer', 'officer'],
    ['officer', 'unknown-mode', 'student'],
    ['unexpected-role', 'officer', 'student'],
  ];

  cases.forEach(([actualRole, requestedMode, expectedRole]) => {
    assert.strictEqual(
      deriveEffectivePortalRole(actualRole, requestedMode),
      expectedRole,
      `Expected actual=${actualRole} requested=${requestedMode} to resolve to ${expectedRole}.`
    );
  });

  assert.strictEqual(hasLeaderPrivilege('student'), false, 'students should not have leader privilege.');
  assert.strictEqual(hasLeaderPrivilege('leader'), true, 'leaders should have leader privilege.');
  assert.strictEqual(hasLeaderPrivilege('officer'), true, 'officers should inherit leader privilege.');
  assert.strictEqual(hasOfficerPrivilege('leader'), false, 'leaders should not have officer privilege.');
  assert.strictEqual(hasOfficerPrivilege('officer'), true, 'officers should have officer privilege.');

  assert.strictEqual(
    shouldShowLeaderAccessDeniedNotice('student', '1'),
    true,
    'student leader-route attempts should show a denied notice.'
  );
  assert.strictEqual(
    shouldShowLeaderAccessDeniedNotice('leader', '1'),
    false,
    'leader attempts should not show a leader denied notice.'
  );
  assert.strictEqual(
    shouldShowOfficerAccessNotice('officer', 'leader', '1'),
    true,
    'officers in lower portal mode should see an officer-mode prompt after officer-route attempts.'
  );
  assert.strictEqual(
    shouldShowOfficerAccessNotice('leader', 'leader', '1'),
    false,
    'leaders should not see an officer-mode prompt.'
  );

  console.log('test-portal-mode-behavior: PASS');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
