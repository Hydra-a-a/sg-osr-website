const { assertContainsOneOf, read } = require('./_security-baseline-helpers');

const source = read('lib/portal-mode.ts');
assertContainsOneOf(
  source,
  [/deriveEffectivePortalRole/, /hasLeaderPrivilege/, /hasOfficerPrivilege/],
  'portal mode auth helpers should define role derivation and privilege checks.'
);

console.log('test-portal-mode-auth: PASS');
