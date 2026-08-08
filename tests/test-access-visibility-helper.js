const { assertContainsOneOf, read } = require('./_security-baseline-helpers');

const source = read('lib/access-visibility.ts');
assertContainsOneOf(
  source,
  [/canSeeLeaderFeatures/, /canSeeOfficerFeatures/, /showLeaderAttemptNotice/],
  'access visibility helper should expose role-aware visibility flags.'
);

console.log('test-access-visibility-helper: PASS');
