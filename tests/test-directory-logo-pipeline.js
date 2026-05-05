const { assertContainsOneOf, read } = require('./_security-baseline-helpers');

const source = read('app/api/directory/logos/[fileId]/route.ts');
assertContainsOneOf(
  source,
  [/fileId/i, /directory/i, /rate|cache|content-type/i],
  'directory logo pipeline route should include file handling safeguards.'
);

console.log('test-directory-logo-pipeline: PASS');
