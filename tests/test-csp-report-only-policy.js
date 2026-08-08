const fs = require('fs');
const assert = require('assert');

const source = fs.readFileSync('proxy.ts', 'utf8');
const reportOnlyMatch = source.match(/function buildCspReportOnlyHeader\([^)]*\): string \{([\s\S]*?)\n\}/);
assert.ok(reportOnlyMatch, 'proxy.ts should define buildCspReportOnlyHeader.');
assert.doesNotMatch(
  reportOnlyMatch[1],
  /upgrade-insecure-requests/,
  'report-only CSP should not include upgrade-insecure-requests because browsers ignore it and emit console noise.'
);

console.log('test-csp-report-only-policy: PASS');
