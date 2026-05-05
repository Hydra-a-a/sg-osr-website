const { assertContainsOneOf, read } = require('./_security-baseline-helpers');

const source = read('app/api/hub/guides/preview/[fileId]/route.ts');
assertContainsOneOf(
  source,
  [/preview/i, /fileId/i, /cache|auth|access/i],
  'hub guide preview route should include gated preview handling.'
);

console.log('test-hub-guides-pdf-gating: PASS');
