const { assertContainsOneOf, read } = require('./_security-baseline-helpers');

const source = read('app/api/forms/route.ts');
assertContainsOneOf(
  source,
  [/auth\(/, /session/i, /unauthorized/i],
  'forms route should include an auth/session guard path.'
);

console.log('test-forms-auth-guard: PASS');
